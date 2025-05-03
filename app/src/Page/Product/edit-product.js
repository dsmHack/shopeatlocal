// edit-product.js
// ---------------
// Edit Product controllers

import _ from "lodash";
import {
  wExec,
  CkFail,
  Retry,
  wUpdOne,
  wClearProductImages,
  wInsertProductImage,
} from "../../Form.js";
import { wSubcatsProducer, ArrayFromCds, CdsAttrProduct } from "../../Db.js";
import { Add_Props, PageAfterEditProduct } from "../../Util.js";
import { CoopParams } from "../../Site.js";
import { wImages, wQueryImages } from "../Shop/product.js";

/** Returns an object containing fields that should be disabled in the form, and
 *  ignored during form processing. */
function FldsDisab(aReq, aResp) {
  const oFlds = {};

  // This warning is displayed permanently in the view:

  if (aResp.PhaseCycEq("StartDeliv") || aResp.PhaseCycEq("EndDeliv")) {
    oFlds.CdStor = {
      Msg: "You cannot change the storage during the delivery cycle",
    };
  }

  const oCkStaff = aReq.user.CkStaff();
  if (!oCkStaff) {
    const oData = { Msg: "Only staff can change this setting." };
    oFlds.CkExcludeConsumerFee = oData;
    oFlds.CkExcludeProducerFee = oData;
  }

  return oFlds;
}

export async function wHandGet(aReq, aResp) {
  // This handler is also invoked after validation failures, so conserve the
  // user's previous input, if any:
  Add_Props(aResp.locals, aResp.locals.ProductSel);

  const oIDProducer = aResp.locals.ProductSel.IDProducer;
  aResp.locals.zCkProductOwn = aReq.user.IDProducer === oIDProducer;
  aResp.locals.Subcats = await wSubcatsProducer(oIDProducer);
  if (!aResp.locals.Subcats.length) {
    aResp.Show_Flash(
      "danger",
      "Cannot edit product!",
      "You must select one or more product categories in your producer " +
        "registration before you edit a product.",
    );
    aResp.redirect(303, "/edit-producer-registration");
    return;
  }
  aResp.locals.AttrsProduct = ArrayFromCds(CdsAttrProduct);
  aResp.locals.FldsDisab = FldsDisab(aReq, aResp);

  const oImages = await wImages(aResp.locals.IDProduct);
  aResp.locals.Images = oImages;

  aResp.locals.Title = `${CoopParams.CoopNameShort} edit product`;
  console.log(aResp.locals);
  aResp.render("Product/edit-product");
}

export async function wHandPost(aReq, aResp) {
  // Field-level validation
  // ----------------------

  const oFlds = {
    NameProduct: { CkRequire: true },
    // I guess we won't require this, since so many are blank in the old
    // database:
    Descrip: { Valid: false },
    IDSubcat: { Valid: false },
    CdStor: {},
    CkAttrOrganCert: {},
    CkAttrNaturGrownCert: {},
    CkAttrRealOrganic: {},
    CkAttrRegenOrganCert: {},
    CkAttrCertBiodynamic: {},
    CkAttrAnimWelfareCert: {},
    CkAttrCert100GrassFed: {},
    CkAttrGlutenFreeCert: {},
    CkAttrVeganCert: {},
    CkAttrFairTradeCert: {},
    CkAttrLocalSelf: {},
    CkAttrFreeRgSelf: {},
    CkAttrPasturedSelf: {},
    CkAttrGrassFedSelf: {},
    CkAttrVegan: {},
    CkAttrVeget: {},
    CkAttrGlutenFree: {},
  };

  const oCkStaff = aReq.user.CkStaff();
  if (oCkStaff) {
    oFlds.CkExcludeConsumerFee = {};
    oFlds.CkExcludeProducerFee = {};
  }

  const oFldsDisab = FldsDisab(aReq, aResp);
  await wExec(aReq.body, oFlds, oFldsDisab);

  // Image upload
  // ------------

  // USER can submit the form without uploading any images, in which the images are kept unchanged.
  //   Query previous images, send them through the current upsert hack (5m)
  // User can submit the form and specify image(s) to be removed, in which case only those images are removed.
  //   Query previous images, remove the specified ones, and send the rest through the current upsert hack (7m)
  // User can submit the form with new images, in which case the old images are removed and the new ones are added.
  //   Current upsert hack will remove all images and add the new ones. (0m)

  // If the user selected a 'new' file, use that. Otherwise, use the previously-
  // selected file, unless the user opted to remove it:
  const oIDProduct = aResp.locals.ProductSel.IDProduct;
  let oNameImg = await wQueryImages(oIDProduct);
  console.log(aReq.body.CkKeepImgs);
  if (aReq.files && aReq.files["Img"] && aReq.files["Img"].length > 0)
    oNameImg = aReq.files["Img"].map(f => f.filename);
  else if (aReq.body.CkKeepImgs) oNameImg = aReq.body.CkKeepImgs.split(",");

  // Handle validation failure
  // -------------------------

  if (CkFail(oFlds)) {
    Retry(aResp, oFlds);
    aResp.locals.NameImgProduct = oNameImg;

    wHandGet(aReq, aResp);
    return;
  }

  // Update product record
  // ---------------------
  // So using this page to change the listing status will cause the edit time to
  // be updated? [TO DO]

  const oParamsEx = {
    NameImgProduct: oNameImg[0],
    WhenEdit: new Date(),
  };

  await wClearProductImages(oIDProduct);
  await wUpdOne("Product", "IDProduct", oIDProduct, oFlds, oParamsEx);
  for (const [i, name] of oNameImg.entries()) {
    await wInsertProductImage(oIDProduct, name, i);
  }

  // Returns to previous page
  // ------------------------

  aResp.Show_Flash("success", null, "The product has been updated.");

  const oPage = PageAfterEditProduct(aReq, aResp);
  aResp.redirect(303, oPage);
}
