module.exports = async ({github, context, config}) => {
    let all_flatcar_branches = {}
    for (let [short_name, full_name] of config.short_to_full_branch_map) {
        all_flatcar_branches[full_name] = {}
    }
    let available_flatcar_branches = {}
    const per_page = 100
    let page = 0
    while (1) {
        // page numbering is 1-based, so we increment it
        // before doing the call
        page++
        const { data: branches } = await github.repos.listBranches({
            owner: context.repo.owner,
            repo: context.repo.repo,
            page: page,
            per_page: per_page,
        })
        for (let branch of branches) {
            if (branch.name in all_flatcar_branches) {
                available_flatcar_branches[branch.name] = true
            }
        }
        if (branches.length < per_page) {
            break
        }
    }
    return available_flatcar_branches
}
