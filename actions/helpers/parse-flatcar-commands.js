module.exports = ({body, target_branch, branches_set, branch_map, bot_name}) => {
    const parse_commands = (() => {
        const path = require('path')
        const script_path = path.resolve('./actions/helpers/parse-commands.js')
        return require(script_path)
    })()

    let s2l_branch_map = {}
    let l2s_branch_map = {}
    let propagate_branches = {}
    let allowed_setting = false
    for (let [short_name, full_name] of branch_map) {
        s2l_branch_map[short_name] = full_name
        l2s_branch_map[full_name] = short_name
        propagate_branches[short_name] = {
            available: full_name in branches_set, // does the project have this branch?
            allowed: allowed_setting, // is it allowed to propagate to this branch?
            specified: false, // was it already specified in the bot command?
        }
        if (target_branch === full_name) {
            allowed_setting = true
        }
    }
    // we will augment the branch descriptions with real branch names
    // and we will drop the bad branches
    let result = parse_commands({
        body: body,
        bot_name: bot_name,
    })
    if (result.cmd_data.propagation_status !== "no") {
        let good_propagation_branches = []
        for (let prop_branch of result.cmd_data.propagation_branches) {
            if (!(prop_branch.desc in s2l_branch_map)) {
                let all_branch_descs = []
                for (let [branch_desc] of branch_map) {
                    if (propagate_branches[branch_desc].allowed) {
                        all_branch_descs.push(`"${branch_desc}"`)
                    }
                }
                if (all_branch_descs.length > 0) {
                    result.errors.push(`"${prop_branch.desc}" is not a valid branch description. Allowed branch descriptions are ${all_branch_descs.join(", ")}.`)
                } else {
                    result.errors.push(`"${prop_branch.desc}" is not a valid branch description. And it's not possible to propagate the changes further.`)
                }
                continue
            }
            if (!propagate_branches[prop_branch.desc].available) {
                result.errors.push(`"${prop_branch.desc}" (${s2l_branch_map[prop_branch.desc]}) is not available in the repo.`)
                continue
            }
            if (!propagate_branches[prop_branch.desc].allowed) {
                result.errors.push(`"${prop_branch.desc}" (${s2l_branch_map[prop_branch.desc]}) is not a valid branch description to propagate to from "${l2s_branch_map[target_branch]}" (${target_branch}).`)
                continue
            }
            propagate_branches[prop_branch.desc].specified = true
            prop_branch.name = s2l_branch_map[prop_branch.desc]
            good_propagation_branches.push(prop_branch)
        }
        result.cmd_data.propagation_branches = good_propagation_branches
        for (let branch_desc in propagate_branches) {
            if (propagate_branches[branch_desc].available && propagate_branches[branch_desc].allowed && !propagate_branches[branch_desc].specified) {
                result.errors.push(`Did not specify the propagation to "${branch_desc}" (${s2l_branch_map[branch_desc]}).`)
            }
        }
    }
    return result
}
