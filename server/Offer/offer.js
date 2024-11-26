const express = require('express');
const cloudinary = require("cloudinary").v2;
const router = express.Router();
const password = require("generate-password");
require('dotenv').config(); 

const cors = require("cors");

router.use(cors());
router.use(express.json());

const Offer = require('./models/Offer');
const auth = require('../middleware/auth');
const User = require('../User/models/User');

const fileUpload = require("express-fileupload");
const { request } = require('http');

const stripe = require("stripe")(process.env.STRIPE);

// configuartion de cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUD_NAME,
    api_key: process.env.API_KEY,
    api_secret: process.env.API_SECRET
});

// permet de convertir le file en base64
const convertToBase64 = (file) => {
    return `data:${file.mimetype};base64,${file.data.toString("base64")}`;
}

// implementation du payment grace a stripe
router.post("/payment", async (req, res) => {
    try {
        // On crée une intention de paiement
        const paymentIntent = await stripe.paymentIntents.create({
            // Montant de la transaction
            amount: req.body.amount,
            // Devise de la transaction
            currency: req.body.currency,
            // Description du produit
            description: req.body.amount,
        });
        // On renvoie les informations de l'intention de paiement au client
        res.json(paymentIntent);
        } catch (error) {
            console.log(error);
            
        res.status(500).json({ message: error.message });
        }
});

// auth permet de verifier si l'utilisateur est connecté
// si le titre, description ... sont non null, alors on créer des id pour les images et pour la publications
// on créer le tableau picture_image par défaut en null sauf si les valeurs file1, file2, file3 existe,
// on créer ensuite la publication.
// le status est de 200 si tout est bon, 400 si le titre/description est trop long ou price est trop grand ou si les champs ne sont pas tous renseignés
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
            const id = password.generate({
                numbers: true,  
                lowercase: false, // Exclure les lettres minuscules
                uppercase: false, // Exclure les lettres majuscules
                symbols: false,    // Exclure les symboles
                length: 24,
            })
            const pictureToUpload = [req.body.file1, req.body.file2, req.body.file3]            
            console.log(pictureToUpload);
            
            const picture = []
            for(let i = 0; i < 3; i++){
                const idImage = password.generate({
                    numbers: true,  
                    lowercase: false, // Exclure les lettres minuscules
                    uppercase: false, // Exclure les lettres majuscules
                    symbols: false,    // Exclure les symboles
                    length: 24,
                })      
                if(pictureToUpload[i] !== ',,,') {
                    const result = await cloudinary.uploader.upload(pictureToUpload[i], {
                        folder: "Vinted/offer/"+req.user._id+id,
                        public_id: idImage
                    });                    
                    picture.push([result.public_id, result.secure_url, result.width, result.height])
                }
                else {
                    picture.push([null, null, null, null])
                }             
            }                       
            const product_image = [
                {
                    cloud_id: picture[0][0],
                    secure_url: picture[0][1],
                    width: picture[0][2],
                    height: picture[0][3]
                },
                {
                    cloud_id: picture[1][0] || null,
                    secure_url: picture[1][1] || null,
                    width: picture[1][2] || null,
                    height: picture[1][3] || null
                },
                {
                    cloud_id: picture[2][0] || null,
                    secure_url: picture[2][1] || null,
                    width: picture[2][2] || null,
                    height: picture[2][3] || null
                }
            ]            
            
            const newOffer = await new Offer({
                _id: id,
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
                product_image: product_image,
                owner: req.user._id,
            })
            await newOffer.save();
            const offer = await Offer.findById(newOffer._id);
            res.status(200).json(offer)
        }
        else res.status(400).json({message: "certains champs ne sont pas renseignés"})
    }
    catch(error){
        console.error(error);
        res.status(500).json({message: "Erreur lors de la publication de l'annonce"})
    }
    
})

// permet de recuperer le nombre de page qu'il faut avoir selon les filtres en query
// status 200 si tout est bon
router.get('/offerNumber', async(req, res) => {
    try{
        let {title, priceMin, priceMax} = req.query;  

        const result = await Offer.find({product_name: {$regex: title||"", $options: 'i'}, product_price: {$gte: priceMin||0, $lt: priceMax||1000001}}).limit(1000).populate("owner", "account");
        const resultLength = Math.ceil(result.length/5);
        
        res.status(200).json(resultLength);
    }
    catch(error){
        console.error(error);
        res.status(500).json({message: "Erreur lors de la récupération des annonces"})
    }
})

// recupere les filtres dans le query, on initialise les bonnes valuers selon les query
// on renvoie le result selon les query envoyés
// status 200 si tout est bon
router.get('/offers', async(req, res) => {
    try{
        let {title, priceMin, priceMax, sort, page} = req.query;  
        if(page !== null && page !== undefined){
            page = parseInt(req.query.page.charAt(1))
        }
        let pageResult = 1;
        let sortResult = undefined;

        let result = "";
        if(page !== null && page !== undefined){
            pageResult = page*5;                        
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
            result = await Offer.find({product_name: {$regex: title||"", $options: 'i'}, product_price: {$gte: priceMin||0, $lt: priceMax||1000001}}).limit(5).skip(pageResult).populate("owner", "account");;
        }
        else {
            result = await Offer.find({product_name: {$regex: title||"", $options: 'i'}, product_price: {$gte: priceMin||0, $lt: priceMax||1000001}}).limit(5).skip(pageResult).sort({product_price: sortResult}).populate("owner", "account");

        }
            res.status(200).json(result);
    }
    catch(error){
        console.error(error);
        res.status(500).json({message: "Erreur lors de la récupération des annonces"})
    }
})

// si on trouve l'il dans la base de données, alors on renvoie l'article avec status 200,
// 404 si on ne trouve pas l'article et 400 si l'id n'est pas renseigné
router.get('/offers/:id', async(req, res) => {
    try{
        const id = req.params.id;        
        if(id !== undefined && id.length === 24){
            const offers = await Offer.findById(id).populate('owner');
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

// auth permet de verifier si l'utilisateur est connecté
// permet de delete une offre selon l'id
// status 200 si tout est bon, 404 si l'offre n'exsite pas dans la base de données, 400 si l'id n'est pas renseignés
router.delete('/offer/:id', auth, async(req, res) => {
    try {
        const id = req.params.id
        if(id !== null && id !== undefined){
            const idUser = req.user._id;            
            const offerExist = await Offer.findOne({owner: idUser, _id: id});     
            const result = await cloudinary.uploader.destroy('Vinted/offer/'+idUser+'/'+id);
            if(offerExist){
                await Offer.findByIdAndDelete(id);
                res.status(200).json({message: 'Offer deleted'})
            }
            else res.status(404).json({message: 'Offer not found'}); return;
            
        }
        else res.status(400).json({message: 'id is required'})
    }
    catch(error){
        console.error(error);
        res.status(500).json({message: "Erreur lors de la suppression de l'annonce"})
    }
})

// auth permet de verifier si l'utilisateur est connecté
// permet de modifier une offre selon l'id
// le product_image n'est pas a jour, car elle n'y a qu'un seul image possible... 🤡
// status 200 si tout est bon, 404 si l'offre n'exsite pas dans la base de données, 400 si l'id n'est pas renseignés
router.put("/offer/:id", auth, fileUpload(),  async (req, res) => {
    try {
        const id = req.params.id;
        const title = req.body.title;
        const description = req.body.description;
        const price = req.body.price;
        const marque = req.body.marque;
        const taille = req.body.taille;
        const etat = req.body.etat;
        const couleur = req.body.couleur;
        const emplacement = req.body.emplacement;
        const userId = req.user._id
        if(id!== null && id!== undefined){            
            const OfferInfo = await Offer.findOne({owner: userId, _id: id});            
            if(OfferInfo){                
                let pictureToUpload = undefined; 
                let image = "";               
                if(req.files !== null){
                    pictureToUpload = await req.files.file;
                }
                if(pictureToUpload !== undefined && pictureToUpload !== null){
                    const result = await cloudinary.uploader.destroy('Vinted/offer/'+req.user._id+'/'+id);
                    console.log(result);
                    if(result.result !== "ok"){
                        console.log("echec de la modification de l'image");
                    }
                    else {
                        image = await cloudinary.uploader.upload(convertToBase64(pictureToUpload), {
                            folder: "Vinted/offer/"+req.user._id,
                            public_id: id
                        });
                    }
                }   
                else {image = "";  newId = undefined;}            
                const result = await Offer.findOneAndUpdate(
                    { _id: id },
                    {
                        $set :{
                            product_name: title !== null ? title: OfferInfo.product_name, 
                            product_description: description !== null ? description: OfferInfo.product_description,
                            product_price: price !== null ? price: OfferInfo.product_price,
                            product_details: {
                                MARQUE: marque !== null && marque !== undefined ? marque: OfferInfo.product_details[0].MARQUE,
                                TAILLE: taille !== null && taille !== undefined ? taille: OfferInfo.product_details[0].TAILLE,
                                ETAT: etat !== null  && etat !== undefined ? etat: OfferInfo.product_details[0].ETAT,
                                COULEUR: couleur !== null  && couleur !== undefined ? couleur: OfferInfo.product_details[0].COULEUR,
                                EMPLACEMENT: emplacement !== null && emplacement !== undefined ? emplacement: OfferInfo.product_details[0].EMPLACEMENT,
                            },
                            product_image: {
                                cloud_id: image.public_id !== null && image.public_id !== undefined ? image.public_id: OfferInfo.product_image[0].cloud_id,
                                secure_url: image.secure_url !== null && image.secure_url !== undefined ? image.secure_url: OfferInfo.product_image[0].secure_url,
                                width: image.width !== null && image.width !== undefined ? image.width: OfferInfo.product_image[0].width,
                                height: image.height !== null && image.height !== undefined ? image.height: OfferInfo.product_image[0].height,
                            },

                        },
                    },
                );
                res.status(200).json(await Offer.findOne(result._id));
            }
            else res.status(404).json({message: 'Offer not found'}); return;
        }
        else res.status(400).json({message: 'id is required'})
    }
    catch(error){
        console.error(error);
        res.status(500).json({message: "Erreur lors de la modification de l'annonce"})
    }
})

module.exports = router;