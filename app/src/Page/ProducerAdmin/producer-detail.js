// producer-detail.js
// ------------------
// Producer detail page controllers

import { wProducerFromID, wQtyPromProducer } from "../../Db.js";
import { CoopParams } from "../../Site.js";

export async function wHandGet(aReq, aResp) {
  const oIDProducer = aResp.locals.CredSelImperUser.IDProducer;
  const oProducer = await wProducerFromID(oIDProducer);

  aResp.locals.Producer = oProducer;
  aResp.locals.Producer.QtyProm = await wQtyPromProducer(oIDProducer);

  aResp.locals.Title = `${CoopParams.CoopNameShort} producer detail`;
  aResp.render("ProducerAdmin/producer-detail");
}
