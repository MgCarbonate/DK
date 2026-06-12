router.get('/payment', requireAuth, async (req, res) => {
    const cards = await Card.findAll({
        where: { user_code: req.session.user.user_code }
    });

    res.render('payment', {
        cards: cards,
        user: req.session.user
    });
});