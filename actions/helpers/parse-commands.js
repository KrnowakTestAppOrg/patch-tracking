module.exports = ({body, bot_name}) => {
    let time_desc_re = /^\s*(\d+)([mwd])\s*$/
    let date_desc_re = /^\s*((\d{4})-(\d{1,2})-(\d{1,2}))\s*$/
    let issue_number_re = /^\s*(\d+)\s*$/
    const lines = body.split("\n")
    // @<bot>: propagate branch_desc date_spec
    // @<bot>: no-propagate
    // @<bot>: close issue_number
    //
    // branch_desc: alpha, beta, stable
    // date_spec: nope, asap, \d+[mwd] (month, week, day), yyyy-mm-dd
    // issue_number: \d+
    let escape_regexp = (str) => {
        return str.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')
    }
    // matches:
    // @bot_name command
    // @bot_name: command
    // @bot_name, command
    // @bot_name : command
    // @bot_name , command
    //
    // but not:
    // @bot_namecommand
    let prefix_re = new RegExp(`^@${escape_regexp(bot_name)}\\b\\s*[:,]?\\s*(.*)$`, "")
    let cmd_data = {
        // Either "yes" if propagating, "no" if not propagating, "?"
        // if no propagation command was found
        propagation_status: "?",
        // Contains objects with "desc" and "date" keys. "desc" is a
        // description of target branch, "date" is a Date object or
        // null if no propagation should take place. Filled only when
        // propagation_status is "yes".
        propagation_branches: [],
        // Contains tracking issue numbers to be closed.
        closings: [],
        // Name of the branch with the resolved conflict or an empty
        // string is none such was specified
        resolve_branch: "",
    }
    let propagation_mixed_warned = false
    let propagate_branches = {}
    let errors = []
    for (let line of lines) {
        let match = line.match(prefix_re)
        if (match === null || match.length !== 2) {
            continue
        }
        line = match[1].trim()
        const [cmd, ...rest] = line.split(/\s+/)
        if (cmd === "no-propagate") {
            if (rest.length !== 0) {
                errors.push(`Expected nothing after "no-propagate" command in "${line}".`)
                continue
            }
            if (cmd_data.propagation_status === "yes") {
                if (!propagation_mixed_warned) {
                    errors.push('Mixed propagation commands (both "propagate" and "no-propagate" in the text).')
                    propagation_mixed_warned = true
                }
                continue
            }
            cmd_data.propagation_status = "no"
            continue
        }
        if (cmd === "close") {
            if (rest.length !== 1) {
                errors.push(`Expected only a number after "close" command in "${line}".`)
                continue
            }
            let match = rest[0].match(issue_number_re)
            if (match === null || match.length !== 2) {
                errors.push(`"${issue_number}" in "${line}" is not a valid issue number.`)
                continue
            }
            const issue_number = match[1]
            cmd_data.closings.push(issue_number)
            continue
        }
        if (cmd === "propagate") {
            if (cmd_data.propagation_status === "no") {
                if (!propagation_mixed_warned) {
                    errors.push('Mixed propagation commands (both "propagate" and "no-propagate" in the text).')
                    propagation_mixed_warned = true
                }
                continue
            }
            cmd_data.propagation_status = "yes"
            const periods = rest.join(" ").split(",")
            for (let period of periods) {
                period = period.trim()
                const words = period.split(/\s+/)
                if (words.length !== 2) {
                    errors.push(`"${period}" is not a valid propagation command.`)
                    continue
                }
                const branch_desc = words[0].trim()
                if (branch_desc in propagate_branches) {
                    errors.push(`"${branch_desc}" in "${period}" was already specified once.`)
                    continue
                }
                propagate_branches[branch_desc] = true
                const time_desc = words[1].trim()
                let date = new Date()
                date = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12)
                if (time_desc === "asap") {
                    // nothing, the date is set to current day already
                } else if (time_desc === "nope") {
                    date = null
                } else {
                    let match = time_desc.match(time_desc_re)
                    if (match === null || match.length !== 3) {
                        match = time_desc.match(date_desc_re)
                        if (match === null || match.length !== 5) {
                            errors.push(`"${time_desc}" in "${period}" is an invalid time description. Should be a number followed by either w (for weeks), d (for days) or h (for hours) or a date in format yyyy-mm-dd.`)
                            continue
                        }
                        const year = parseInt(match[2], 10)
                        const month = parseInt(match[3], 10)
                        const day = parseInt(match[4], 10)
                        // months are zero-based in Date, but we
                        // use 1-based in our messages
                        date = new Date(year, month-1, day, 12)
                        if ((date.getFullYear() !== year) || (date.getMonth() !== month-1) || (date.getDate() !== day)) {
                            errors.push(`"${time_desc}" in "${period}" is an invalid date. It resulted in ${date.getFullYear()}-${date.getMonth()+1}-${date.getDate()}.`)
                            continue
                        }
                    } else {
                        switch (match[2]) {
                        case "m":
                            date.setMonth(date.getMonth() + parseInt(match[1], 10))
                            break
                        case "w":
                            date.setDate(date.getDate() + parseInt(match[1], 10) * 7)
                            break
                        case "d":
                            date.setDate(date.getDate() + parseInt(match[1], 10))
                            break
                        }
                    }
                }
                cmd_data.propagation_branches.push({
                    desc: branch_desc,
                    date: date,
                })
            }
            continue
        }
        if (cmd === "resolve") {
            if (rest.length !== 1) {
                errors.push(`Expected one parameter for the "resolve" command being a name of a branch in "${line}"`)
                continue
            }
            if (cmd_data.resolve_branch.length !== 0) {
                errors.push(`The branch with resolved conflict is already specified ("${branch}")`)
                continue
            }
            cmd_data.resolve_branch = rest[0]
            continue
        }
        errors.push(`Unknown command "${cmd}".`)
    }
    return {
        cmd_data: cmd_data,
        errors: errors,
    }
}
