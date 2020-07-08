module.exports = ({body, config, target_branch, branches_set}) => {
    const parse_commands = (() => {
        const path = require('path')
        const scriptPath = path.resolve('./parse-commands.js')
        return require(scriptPath)
    })()

    let s2l_branch_map = {}
    let l2s_branch_map = {}
    let propagate_branches = {}
    let allowed_setting = false
    for (let [short_name, full_name] of config.short_to_full_branch_map) {
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
    const result = parse_commands({
        body: body,
        bot_name: config.bot_name,
    })
    if (result.cmd_data.propagation_status !== "no") {
        for (let prop_branch of result.cmd_data.propagation_branches) {
            if (!(prop_branch.name in s2l_branch_map)) {
                let all_branch_names = []
                for (let [branch_desc] of config.short_to_full_branch_map) {
                    if (propagate_branches[branch_desc].allowed) {
                        all_branch_names.push(`"${branch_desc}"`)
                    }
                }
                if (all_branch_names.length > 0) {
                    result.errors.push(`"${prop_branch.name}" is not a valid branch description. Allowed branch descriptions are ${all_branch_names.join(", ")}.`)
                } else {
                    result.errors.push(`"${prop_branch.name}" is not a valid branch description. And it's not possible to propagate the changes further.`)
                }
                continue
            }
            if (!propagate_branches[prop_branch.name].available) {
                result.errors.push(`"${prop_branch.name}" (${s2l_branch_map[prop_branch.name]}) is not available in the repo.`)
                continue
            }
            if (!propagate_branches[prop_branch.name].allowed) {
                result.errors.push(`"${prop_branch.name}" (${s2l_branch_map[prop_branch.name]}) is not a valid branch description to propagate to from "${l2s_branch_map[target_branch]}" (${target_branch}).`)
                continue
            }
            propagate_branches[prop_branch.name].specified = true
        }
        for (let branch_desc in propagate_branches) {
            if (propagate_branches[branch_desc].available && propagate_branches[branch_desc].allowed && !propagate_branches[branch_desc].specified) {
                result.errors.push(`Did not specify the propagation to "${branch_desc}" (${s2l_branch_map[branch_desc]}).`)
            }
        }
    }
    return result
}
