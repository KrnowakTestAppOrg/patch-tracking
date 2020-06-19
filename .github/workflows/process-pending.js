module.exports = ({context, github, io}) => {
    (async () => {
        const central_repo_owner = "KrnowakTestAppOrg"
        const central_repo_repo = "central"
        const central_pending_column_id = "9618257"
        let page = 0
        const per_page = 100

        while (1) {
            page++
            const { data: cards } = await github.projects.listCards({
                column_id: central_pending_column_id,
                page: page,
                per_page: per_page,
            })
            for (let card of cards) {
                if (card.note !== null) {
                    console.log("card is not an issue card", card.url)
                    continue
                }
                // https://api.github.com/repos/KrnowakTestAppOrg/central/issues/6
                const parts = card.content_url.split('/')
                if (parts.length < 4) {
                    console.log("bogus content url", card.content_url)
                }
                const issue_num_idx = parts.length - 1
                const content_type_idx = parts.length - 2
                const repo_idx = parts.length - 3
                const owner_idx = parts.length - 4
                if (parts[owner_idx] !== central_repo_owner) {
                    console.log("issue url:", card.content_url, "outside the expected owner, got:", parts[owner_idx], "expected:", central_repo_owner)
                    continue
                }
                if (parts[repo_idx] !== central_repo_repo) {
                    console.log("issue url:", card.content_url, "outside the expected repo, got:", parts[repo_idx], "expected:", central_repo_repo)
                    continue
                }
                if (parts[content_type_idx] !== 'issues') {
                    console.log("issue url:", card.content_url, "not the expected content type, got:", parts[content_type_idx], "expected:", 'issues')
                    continue
                }
                const issue_number = parseInt(parts[issue_num_idx], 10)
                if (isNaN(issue_number)) {
                    console.log("issue url:", card.content_url, "issue number is not a number, got:", parts[issue_num_idx])
                    continue
                }
                const { data: issue } = await github.issues.get({
                    owner: central_repo_owner,
                    repo: central_repo_repo,
                    issue_number: issue_number,
                })
                console.log(issue.body)
            }
            if (cards.length < per_page) {
                break
            }
        }
    })();
}
