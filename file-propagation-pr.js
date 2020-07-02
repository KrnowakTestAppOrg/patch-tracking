// pr_data should have its card_id field filled
module.exports = async ({github, config, pr_data, head_branch, issue_number}) => {
    console.log('config', config, 'pr_data', pr_data, 'head_branch', head_branch, 'issue_number', issue_number)
    await github.projects.moveCard({
        card_id: pr_data.card_id,
        position: "top",
        column_id: config.central_awaiting_review_column_id,
    })
    const { data: filed_pr } = await github.pulls.create({
        owner: pr_data.owner,
        repo: pr_data.repo,
        title: `For ${pr_data.branch}: ${pr_data.title}`,
        head: head_branch,
        base: pr_data.branch,
        body: [
            `@${config.bot_name}: close ${issue_number}`,
            `@${config.bot_name}: no-propagate`,
            "",
            `Based on PR #${pr_data.pr}`
        ].join("\n"),
    })
    await github.issues.createComment({
        owner: config.central_repo_owner,
        repo: config.central_repo_repo,
        issue_number: issue_number,
        body: `Filed ${filed_pr.html_url}.`,
    })
    await github.issues.update({
        owner: config.central_repo_owner,
        repo: config.central_repo_repo,
        issue_number: issue_number,
        body: [`filed-pr: ${filed_pr.html_url}`, issue.body].join("\n")
    })
}
