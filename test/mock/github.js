const http = require('http')
const url = require('url')
const events = require('events')
const { Octokit } = require('@octokit/rest')

module.exports = async () => {
    class GitHubServerMock {
        constructor() {
            // Map[verb -> Map[path -> callback]]
            this.routes = new Map()
            this.server = http.createServer((request, response) => {
                const paths = this.routes.get(request.method)

                if (paths === undefined) {
                    response.writeHead(404, 'Not Found').end("<h1>404</h1>")
                    return
                }

                const parsed_url = new URL(request.url, `http://${request.headers.host}`)
                const reply_callback = paths.get(parsed_url.pathname)
                const paginator = (slice_of_stuff) => {
                    let with_default = function(value, default_value) {
                        if (value !== null) {
                            value = parseInt(value, 10)
                            if (isNaN(value) || value < 1) {
                                value = null
                            }
                        }
                        if (value === null) {
                            value = default_value
                        }
                        return value
                    }
                    const page = with_default(parsed_url.searchParams.get('page'), 1)
                    const per_page = with_default(parsed_url.searchParams.get('per_page'), 30)
                    const first_index = (page - 1) * per_page
                    const last_index = page * per_page
                    const first_page = (() => {
                        if (page === 1) {
                            return null
                        }
                        return 1
                    })()
                    const prev_page = (() => {
                        if (page === first_page) {
                            return null
                        }
                        return page - 1
                    })()
                    const last_page = Math.floor(slice_of_stuff.length / per_page) + 1
                    const next_page = (() => {
                        if (page === last_page) {
                            return null
                        }
                        return page + 1
                    })()
                    let links = []
                    const base_url = this.get_base_url()
                    const paged_url = `http://${base_url}${parsed_url.pathname}?page=`
                    let gen_link = function(page_num, page_name) {
                        return `<${paged_url}${page_num}>; rel="${page_name}"`
                    }
                    if (first_page !== null) {
                        links.push(gen_link(first_page, 'first'))
                    }
                    if (prev_page !== null) {
                        links.push(gen_link(prev_page, 'prev'))
                    }
                    if (last_page !== null) {
                        links.push(gen_link(last_page, 'last'))
                    }
                    if (next_page !== null) {
                        links.push(gen_link(next_page, 'next'))
                    }
                    if (links.length > 0) {
                        response.setHeader('Link', links)
                    }
                    return slice_of_stuff.slice(first_index, last_index)
                }

                if (reply_callback !== undefined) {
                    response.setHeader('Content-Type', 'application/json');
                    response.end(reply_callback(paginator))
                } else {
                    response.writeHead(404, 'Not Found').end()
                }
            })
        }

        async close() {
            this.server.close()
            await events.once(this.server, 'close')
        }

        add_route(verb, path, reply_callback) {
            let paths = this.routes.get(verb)
            if (paths === undefined) {
                paths = new Map()
                this.routes.set(verb, paths)
            }
            paths.set(path, reply_callback)
        }

        get_base_url() {
            const address = this.server.address()
            return `http://${address.address}:${address.port}`
        }

        get_octokit() {
            return new Octokit({
                baseUrl: this.get_base_url()
            })
        }
    }

    let server = new GitHubServerMock()
    server.server.listen(0, "0.0.0.0")
    await events.once(server.server, 'listening')
    return server
}
