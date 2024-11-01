const User = require('../User/models/User');
const axios = require('axios');


const auth = async(req, res, next) => {
    if(req.headers.authorization){
        const user = await User.findOne({
            token: req.headers.authorization.replace('Bearer ','')
        })
        if(!user){
            return res.status(401).json({message: "Unauthorized"});
        }
        else {
            req.user = user;
            return next();
        }
    }
    else {
        return res.status(401).json({message: "Unauthorized"});
    }
}

module.exports = auth;