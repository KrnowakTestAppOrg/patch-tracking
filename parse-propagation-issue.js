module.exports = ({body}) => {
    const lines = body.split("\n")
    let commits_now = false
    let pr_data = {
        owner: "",
        repo: "",
        pr: 0,
        branch: "",
        filed_pr: 0, // Filled only on cherry-pick success.
        card_id: "", // Filled only on cherry-pick error.
        date: null, // Date object.
        title: "",
        commits: [],
    }
    let errors = []
    lines_loop:
    for (let line of lines) {
        line = line.trim()
        if (line.length === 0) {
            continue
        }
        if (!commits_now) {
            let [key, ...values] = line.split(':')
            let value = values.join(':')
            key = key.trim()
            value = value.trim()
            switch (key) {
            case 'owner':
                pr_data.owner = value
                break
            case 'repo':
                pr_data.repo = value
                break
            case 'original-pr':
                pr_data.pr = parseInt(value, 10)
                break
            case 'branch':
                pr_data.branch = value
                break
            case 'date':
                let match = value.match(date_desc_re)
                if (match === null || match.length !== 5) {
                    errors.push(`Invalid date ${value} in "${line}".`)
                    continue lines_loop
                }
                const year = parseInt(match[2], 10)
                const month = parseInt(match[3], 10)
                const day = parseInt(match[4], 10)
                // months are zero-based in Date, but we
                // use 1-based in our messages
                let issue_date = new Date(year, month-1, day, 12)
                if ((issue_date.getFullYear() !== year) || (issue_date.getMonth() !== month-1) || (issue_date.getDate() !== day)) {
                    errors.push(`Bogus date ${value} (actually ${issue_date.getFullYear()}-${issue_date.getMonth()+1}-${issue_date.getDate()}) in line "${line}".`)
                    continue lines_loop
                }
                pr_data.date = issue_date
                break
            case 'filed-pr':
                pr_data.filed_pr = value
                break
            case 'card-id':
                pr_data.card_id = value
                break
            case 'title':
                pr_data.title = value
                break
            case 'commits':
                commits_now = true
                break
            }
        } else {
            if (/^[0-9A-Fa-f]{40}$/.test(line)) {
                pr_data.commits.push(line)
            } else {
                errors.push(`"${line}" is not a valid commit.`)
                continue lines_loop
            }
        }
    }
    return {
        pr_data: pr_data,
        errors: errors,
    }
}
