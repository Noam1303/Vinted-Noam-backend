const express = require('express');
const User = require("./models/User");
const router =  express.Router();
const SHA256 = require('crypto-js/sha256');
const encBase64 = require('crypto-js/enc-base64');
const uid2 = require("uid2");

router.post("/user/signup", async(req, res) => {
    try{
        const {username, email, password, newletter} = req.body;
        const salt = uid2(16);
        const hash = SHA256(password + salt).toString(encBase64);
        const token = uid2(16);
        if(username !== null && email !== null && password !== null && newletter !== null){
            const userExist = await User.findOne({email: email});
            if(userExist){
                res.status(400).json({message: "an user already exist with this email"})
                return;
            }
            const newUser = new User({
                email: email,
                account: {
                    username: username,
                    avatar: null,
                },
                newsletter: newletter,
                token: token,
                hash: hash,
                salt: salt
            }) 
            await newUser.save();
            res.status(200).json({_id: newUser._id,                
                                token: newUser.token,
                                account:{
                                    username: newUser.account.username
                                }
            })
            return;
        }
        else {
            res.status(400).json({message: "erreur sur les champs renseignés"})
        }
    }
    catch(error){
        console.error(error);
        res.status(500).json({message: "Erreur lors de la création de l'utilisateur"})
    }
})


router.post("/user/login", async(req, res) => {
    try{
        const {email, password} = req.body;
        if(email !== null && password !== null){
            const findUser = await User.findOne({email: email});
            if(!findUser){
                res.status(404).json({message: "Utilisateur non trouvé"})
                return;
            }
            const hash = SHA256(password + findUser.salt).toString(encBase64);                        
            if(hash === findUser.hash){
                res.status(200).json({_id: findUser._id,
                                token: findUser.token,
                                account:{
                                    username: findUser.account.username
                                }
                })
                return;
            }
            else res.status(404).json({message: "Mot de passe incorrect"})
        }
        else res.status(400).json({message: "Erreur sur les champs renseignés"})
    }
    catch(error){
        console.error(error);
        res.status(500).json({message: "Erreur lors de la connexion"})
    }
})

module.exports = router;