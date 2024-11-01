const express = require('express');
const cloudinary = require("cloudinary").v2;
const router = express.Router();
require('dotenv').config(); 

const Offer = require('./models/Offer');
const auth = require('../middleware/auth');
const User = require('../User/models/User');

const fileUpload = require("express-fileupload");

cloudinary.config({
    cloud_name: process.env.CLOUD_NAME,
    api_key: process.env.API_KEY,
    api_secret: process.env.API_SECRET
});

const convertToBase64 = (file) => {
    return `data:${file.mimetype};base64,${file.data.toString("base64")}`;
}

router.post('/offer/publish', auth, fileUpload(), async(req, res) => {
    try{    
        const title = req.body.title;
        const description = req.body.description;
        const condition = req.body.condition;
        const price = req.body.price;
        const city = req.body.city;
        const brand = req.body.brand;
        const size = req.body.size;
        const color = req.body.color;        

        if(title !== null && description !== null && condition !== null && price !== null && city !== null && brand !== null && size !== null && color !== null) {
            if(title.length > 50 || description.length > 500 || price > 100000){
                res.status(400).json({message: "limite atteinte"})
                return;
            }
            const pictureToUpload = req.files.file;              
            const result = await cloudinary.uploader.upload(convertToBase64(pictureToUpload), {
                folder: "Vinted/offer/"+req.user._id
            });
            
            const newOffer = await new Offer({
                product_name: title,
                product_description: description,
                product_price: price,
                product_details: {
                    MARQUE: brand,
                    TAILLE: size,
                    ETAT: condition, 
                    COULEUR: color,
                    EMPLACEMENT: city,
                },
                product_image: {
                    cloud_id: result.public_id,
                    secure_url: result.secure_url,
                    width: result.width,
                    height: result.height,
                },
                owner: req.user._id,
            })
            await newOffer.save();
            const offer = await Offer.findById(newOffer._id).populate("owner");
            res.status(200).json(offer)
        }
    }
    catch(error){
        console.error(error);
        res.status(500).json({message: "Erreur lors de la publication de l'annonce"})
    }
    
})

router.get('/offers', async(req, res) => {
    try{
        const {title, priceMin, priceMax, sort, page} = req.query;
        let pageResult = 0;
        let sortResult = undefined;
        let result = "";
        if(page !== null && page !== undefined){
            pageResult = page*2;
        }
        if(sort !== null && sort !== undefined){
            if(sort === "price-desc"){
                sortResult = -1;
            }
            else if(sort === "price-asc"){
                sortResult = 1;
            }
            else sortResult = 1;
        }
        if(sortResult === undefined){
            result = await Offer.find({product_name: {$regex: title||"", $options: 'i'}, product_price: {$gte: priceMin||0, $lt: priceMax||1000001}}).limit(2).skip(pageResult);
        }
        else {
            result = await Offer.find({product_name: {$regex: title||"", $options: 'i'}, product_price: {$gte: priceMin||0, $lt: priceMax||1000001}}).limit(2).skip(pageResult).sort({product_price: sortResult})

        }
            res.status(200).json(result);
    }
    catch(error){
        console.error(error);
        res.status(500).json({message: "Erreur lors de la récupération des annonces"})
    }
})


router.get('/offers/:id', async(req, res) => {
    try{
        const id = req.params.id;        
        if(id !== undefined && id.length === 24){
            const offers = await Offer.findById(id);
            if(offers !== null){
                res.status(200).json(offers);
            }
            else res.status(404).json({message: 'Offer not found'});
        }
        else res.status(400).json({message: 'id is required'})
    }
    catch(error){
        console.error(error);
        res.status(400).json({message: "request error"})
    }
})

module.exports = router;