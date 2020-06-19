module.exports = ({context, github, io}) => {
    (async () => {
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
                console.log(card)
            }
            if (cards.length < per_page) {
                break
            }
        }
    })();
}
