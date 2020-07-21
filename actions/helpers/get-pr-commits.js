// This function retrieves commits of the PR, ensures that they are
// linear and sorts them by ancestor-descendant relationship,
// ancestors first, descendants last.
module.exports = async ({owner, repo, pull_number, github}) => {
    let page = 0
    let per_page = 100
    let pr_commits = []
    let sha_to_child_sha = new Map() // string -> string
    let sha_to_parent_sha = new Map() // string -> string
    let errors = []
    while (1) {
        // page numbering is 1-based, so we increment it
        // before doing the call
        page++
        const { data: commits } = await github.pulls.listCommits({
            owner: owner,
            repo: repo,
            pull_number: pull_number,
            per_page: per_page,
            page: page,
        })
        for (let commit of commits) {
            if (commit.parents.length > 1) {
                return {
                    commits: [],
                    error: `Commit ${commit.sha} has more than one parent. Make sure that the commits in PR are linear.`,
                }
            }
            const parent_sha = commit.parents[0].sha
            if (sha_to_parent_sha.has(commit.sha)) {
                return {
                    commits: [],
                    error: `Commit ${commit.sha} appears twice in a PR.`,
                }
            }
            sha_to_parent_sha.set(commit.sha, parent_sha)
            if (sha_to_child_sha.has(parent_sha) && sha_to_child_sha.get(parent_sha) !== commit.sha) {
                return {
                    commits: [],
                    error: `Commit ${parent_sha} has more than one child. Make sure that the commits in PR are linear.`,
                }
            }
            sha_to_child_sha.set(parent_sha, commit.sha)
        }
        if (commits.length < per_page) {
            break
        }
    }
    let commit = ""
    for (let [parent_sha, child_sha] of sha_to_child_sha.entries()) {
        if (!sha_to_parent_sha.has(parent_sha)) {
            commit = child_sha
            break
        }
    }
    if (commit.length === 0) {
        return {
            commits: [],
            error: "No first commit found?",
        }
    }
    let commits = [commit]
    while (sha_to_child_sha.has(commit)) {
        commit = sha_to_child_sha.get(commit)
        commits.push(commit)
    }
    return {
        commits: commits,
        error: "",
    }
}
