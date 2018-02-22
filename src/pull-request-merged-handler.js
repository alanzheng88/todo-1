const parseDiff = require('./utils/parse-diff')
const checkForDuplicateIssue = require('./utils/check-for-duplicate-issue')
const handlerSetup = require('./utils/handler-setup')
const reopenClosed = require('./utils/reopen-closed')
const { assignFlow, endDiff } = require('./utils/helpers')
const { issueFromMerge } = require('./templates')

module.exports = async context => {
  const [
    { regex, config, labels },
    { data: diff }
  ] = await Promise.all([
    handlerSetup(context),
    context.github.pullRequests.get(context.issue({
      headers: { Accept: 'application/vnd.github.diff' }
    }))
  ])

  let match
  while ((match = regex.exec(endDiff(diff))) !== null) {
    const parsed = parseDiff({ match, context, config })

    if (parsed.filename === '.github/config.yml') continue

    // Prevent duplicates
    const existingIssue = await checkForDuplicateIssue(context, parsed.title)
    if (existingIssue) {
      context.log(`Duplicate issue found with title [${parsed.title}]`)
      await reopenClosed({ context, config, issue: existingIssue }, parsed)
      continue
    }

    const body = issueFromMerge(context.repo({
      sha: parsed.sha,
      assignedToString: parsed.assignedToString,
      range: parsed.range,
      filename: parsed.filename,
      keyword: parsed.keyword,
      number: parsed.number,
      body: parsed.body
    }))

    context.log(`Creating issue [${parsed.title}] in [${context.repo().owner}/${context.repo().repo}`)
    await context.github.issues.create(context.repo({ title: parsed.title, body, labels, ...assignFlow(config, parsed.username) }))
  }
}