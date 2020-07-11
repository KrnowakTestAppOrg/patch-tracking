module.exports = async ({github, pr_data, head_branch, issue_number, target_column_id, bot_name, central_owner, central_repo}) => {
    if (pr_data.card_id === 0) {
        // TODO: proper error
        throw "no card id in PR data"
    }
    const pr_data_to_issue_body = (() => {
        const path = require('path')
        const script_path = path.resolve('./actions/helpers/pr-data-to-issue-body.js')
        return require(script_path)
    })()
    await github.projects.moveCard({
        card_id: pr_data.card_id,
        position: "top",
        column_id: target_column_id,
    })
    const { data: filed_pr } = await github.pulls.create({
        owner: pr_data.owner,
        repo: pr_data.repo,
        title: `For ${pr_data.branch}: ${pr_data.title}`,
        head: head_branch,
        base: pr_data.branch,
        body: [
            `@${bot_name}: close ${issue_number}`,
            `@${bot_name}: no-propagate`,
            "",
            `Based on PR #${pr_data.pr}`
        ].join("\n"),
    })
    await github.issues.createComment({
        owner: central_owner,
        repo: central_repo,
        issue_number: issue_number,
        body: `Filed ${filed_pr.html_url}.`,
    })
    pr_data.filed_pr_url = filed_pr.html_url
    await github.issues.update({
        owner: central_owner,
        repo: central_repo,
        issue_number: issue_number,
        body: pr_data_to_issue_body({pr_data}),
    })
}
