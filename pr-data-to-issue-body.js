module.exports = ({pr_data}) => {
    let body = []
    if (pr_data.filed_pr_url.length > 0) {
        body.push(`filed-pr-url: ${pr_data.filed_pr_url}`)
    }
    body.push(`title: ${pr_title}`)
    body.push(`owner: ${pr_data.owner}`)
    body.push(`repo: ${pr_data.repo}`)
    body.push(`original-pr: ${pr_data.pr}`)
    body.push(`branch: ${pr_data.branch}`)
    body.push(`date: ${pr_data.date.getFullYear()}-${pr_data.date.getMonth()+1}-${pr_data.date.getDate()}`)
    if (pr_data.card_id > 0) {
        body.push(`card-id: ${pr_data.card_id}`)
    }
    body.push(`commits:`)
    body.push(...pr_data.commits)
    return body.join("\n")
}
