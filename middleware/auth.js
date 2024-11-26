const User = require('../User/models/User');
const axios = require('axios');


const auth = async(req, res, next) => {    
    console.log(req.body);
    
    if(req.headers.authorization){
        // si le token existe dans la base de donnée d'un utilisateur, alors insigne dans req.user le user et on next(), sinon on interrompt avec un status 401
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