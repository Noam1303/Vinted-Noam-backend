const mongoose = require('mongoose');

// initialisation du model User

const User = mongoose.model('User', {
    email: String,
    account: {
        username: String,
        avatar: Object,
    },
    newsletter: Boolean,
    token: String,
    hash: String,
    salt: String
})

module.exports = User;