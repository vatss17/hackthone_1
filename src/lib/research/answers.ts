/**
 * AI-assisted research answers for the screening questions marked "Needs expert confirmation".
 *
 * HOW TO READ THIS FILE
 *  - These answers were researched from public sources on the date below and written in plain language. They are DRAFTS: every answer
 *    carries its confidence, what still has to be confirmed, and the sources it rests on (some are secondary sources whose official text
 *    was not opened). Nothing here is legal, customs or tax advice, and none of it is an approval.
 *  - The product treats the destination market as a parameter. This data set covers the MVP's demo destination; another country is a
 *    new data set with the same shape, which is how the research assistant extends to all countries.
 *  - The interface presents these through "Get AI answer" and says plainly that they are drafts a person must confirm. In a live
 *    deployment the same shape is produced by the AI provider with retrieval (see docs/ai-research.md).
 */
export type ResearchConfidence = "high" | "medium" | "low";

export interface ResearchSource {
  title: string;
  publisher: string;
  url: string;
}

export interface ResearchAnswer {
  answer: string;
  keyPoints: string[];
  confidence: ResearchConfidence;
  whatToConfirm: string;
  sources: ResearchSource[];
}

export const RESEARCH_AS_OF = "2026-10-22";

export const RESEARCH: Record<string, ResearchAnswer> = {
 "common.importer": {
  "answer": "The importer of record is the local company that clears the goods and holds the obligations on that side. It generally needs a valid trade licence covering the product activity and a customs registration (import code). For products under a mandatory conformity scheme, the importer or the manufacturer usually applies for the certificate through an authorised certification body.",
  "keyPoints": [
   "Trade licence covering the activity",
   "Customs import registration",
   "Conformity certificate applications go through an authorised certification body",
   "Free-zone licences may limit sales to the mainland"
  ],
  "confidence": "medium",
  "whatToConfirm": "Ask your buyer for copies of their trade licence and customs registration, and confirm with a customs broker whether they can import this tariff line.",
  "sources": [
   {
    "title": "Product conformity: ECAS and EQM certification explained",
    "publisher": "SGS",
    "url": "https://www.sgs.com/en/news/2024/06/pca-2024-q2-navigating-uae-product-conformity-understanding-ecas-and-eqm-certification"
   }
  ]
 },
 "common.technical": {
  "answer": "Possibly. The national standards ministry (MoIAT) runs mandatory conformity schemes, ECAS (certificate valid one year) and the quality mark EQM (three years), for regulated products, covering imports and local goods. Listed categories include electrical items, childcare articles and food-contact materials. Whether a specific plastic product is regulated depends on its category and tariff line, and We could not find a published list for plastics.",
  "keyPoints": [
   "ECAS and EQM apply to regulated products, imported or local",
   "Issued through MoIAT-authorised certification bodies",
   "region-wide technical regulations also exist, for example for toys",
   "Pipes for drinking water are under a drinking-water control system"
  ],
  "confidence": "medium",
  "whatToConfirm": "Ask MoIAT or an authorised certification body whether your product category is on the regulated list today.",
  "sources": [
   {
    "title": "Product conformity: ECAS and EQM certification explained",
    "publisher": "SGS",
    "url": "https://www.sgs.com/en/news/2024/06/pca-2024-q2-navigating-uae-product-conformity-understanding-ecas-and-eqm-certification"
   },
   {
    "title": "MoIAT service cards",
    "publisher": "Bureau Veritas",
    "url": "https://cdn3-verigates.bureauveritas.com/sites/verigates/files/2023-02/AE%20-%20MoIAT%20Service%20Cards%2009022023.pdf"
   }
  ]
 },
 "common.duty": {
  "answer": "Secondary sources say most goods are charged the regional common external tariff of 5% on CIF value, with higher rates for items such as tobacco and alcohol. A regional integrated customs tariff reportedly took effect on 1 January 2025. The exact rate for your product depends on its 8-digit tariff line, and preferential treatment may apply under the India trade agreement if origin rules are met.",
  "keyPoints": [
   "General rate reported as 5% of CIF value",
   "Rate depends on the tariff line",
   "New regional integrated tariff reported from 1 January 2025",
   "No official tariff page was opened"
  ],
  "confidence": "medium",
  "whatToConfirm": "Have a customs broker check the current tariff for your HS code and any preferential rate.",
  "sources": [
   {
    "title": "Legal provisions overview for the destination market (2025)",
    "publisher": "Swiss Federal Travel Centre",
    "url": "https://www.bundesreisezentrale.admin.ch/content/dam/countries/countries-content/united-arab-emirates/en/2025_EN_UAE-legal-provisions.pdf"
   },
   {
    "title": "Import duties and customs clearance guide",
    "publisher": "Golocad",
    "url": "https://golocad.com/blog/uae-import-duties-and-customs-e-commerce-guide/"
   }
  ]
 },
 "common.vat": {
  "answer": "Secondary sources report a 5% standard VAT that also applies to imports. A business must register once taxable supplies and imports exceed AED 375,000 in 12 months (voluntary registration from AED 187,500). A registered importer normally recovers import VAT as input tax, so it is usually a cash-flow item rather than a cost.",
  "keyPoints": [
   "Standard rate 5%",
   "Mandatory registration threshold AED 375,000",
   "Voluntary threshold AED 187,500",
   "Import VAT charged on customs value plus duty"
  ],
  "confidence": "medium",
  "whatToConfirm": "Confirm with the importer and a tax adviser that they are registered and how import VAT is accounted for; the national tax authority site was not retrieved.",
  "sources": [
   {
    "title": "VAT and excise tax guide",
    "publisher": "Chambers and Partners",
    "url": "https://chambers.com/articles/vat-and-excise-tax"
   },
   {
    "title": "VAT services",
    "publisher": "BDO",
    "url": "https://ae-www.bdo.global/en-gb/services/tax/vat"
   }
  ]
 },
 "fc.uae.contact": {
  "answer": "Food-contact materials are a regulated category under the MoIAT conformity system, where a certificate of conformity needs a valid test report from an accredited, recognised laboratory against the approved applicable standard. We could not confirm the exact standard for plastic articles from an official page. regional food-contact standards are generally the reference, so plan on migration testing for your material.",
  "keyPoints": [
   "Certificate of conformity for food-contact materials exists as a MoIAT service",
   "Test report from an accredited laboratory required",
   "Exact governing standard not confirmed"
  ],
  "confidence": "low",
  "whatToConfirm": "Ask MoIAT or an authorised certification body which standard and test methods apply to your product type.",
  "sources": [
   {
    "title": "MoIAT service cards",
    "publisher": "Bureau Veritas",
    "url": "https://cdn3-verigates.bureauveritas.com/sites/verigates/files/2023-02/AE%20-%20MoIAT%20Service%20Cards%2009022023.pdf"
   },
   {
    "title": "Food contact material registration",
    "publisher": "Rizmona",
    "url": "https://www.rizmona.com/product-registration/food-contact-material-registration"
   }
  ]
 },
 "fc.uae.single": {
  "answer": "Yes, single-use items are restricted in stages. Federal Cabinet Resolution No. 380 of 2022 regulates single-use products nationally. One municipal phase-out ended on 1 January 2026 for single-use plastic plates, cutlery and beverage cups with lids, after earlier bans on bags and polystyrene items. The environment ministry also announced a 2026 ban on importing, producing and trading single-use plastics. Reusable products appear to be outside the rules, but check the definition.",
  "keyPoints": [
   "Cabinet Resolution No. 380 of 2022",
   "Plates, cutlery, cups and lids covered from 1 January 2026 in one municipality",
   "Federal import and trade ban announced for 2026",
   "Reusable products should be checked against the definition"
  ],
  "confidence": "medium",
  "whatToConfirm": "Check the resolution text and current item list with the environment ministry before shipping disposable tableware.",
  "sources": [
   {
    "title": "Final phase of single-use plastic ban from 2026",
    "publisher": "Municipal authority",
    "url": "https://www.dm.gov.ae/dubai-to-enforce-final-phase-of-single-use-plastic-ban-from-2026/"
   },
   {
    "title": "Plan to ban single-use plastics by 2026",
    "publisher": "regional News",
    "url": "https://gulfnews.com/living-in-uae/ask-us/uaes-plan-to-ban-single-use-plastics-by-2026-everything-you-need-to-know-1.500272559"
   }
  ]
 },
 "fc.uae.regis": {
  "answer": "Probably yes in some form. A consultancy source says food-contact materials need MoIAT (formerly ESMA) certification, and that registration at the municipal level may also be needed through a local food-safety system. We could not confirm this from an official page, so treat it as likely rather than certain. Registration typically involves the importer.",
  "keyPoints": [
   "Federal conformity certificate for food-contact materials",
   "Possible additional municipal registration",
   "Importer is usually the applicant"
  ],
  "confidence": "low",
  "whatToConfirm": "Ask the importer and the relevant municipal food-safety authority what registration applies to your product.",
  "sources": [
   {
    "title": "Food contact material registration",
    "publisher": "Rizmona",
    "url": "https://www.rizmona.com/product-registration/food-contact-material-registration"
   },
   {
    "title": "MoIAT service cards",
    "publisher": "Bureau Veritas",
    "url": "https://cdn3-verigates.bureauveritas.com/sites/verigates/files/2023-02/AE%20-%20MoIAT%20Service%20Cards%2009022023.pdf"
   }
  ]
 },
 "hg.uae.conf": {
  "answer": "We found no source saying general household plastics (boxes, buckets, hangers) need a MoIAT conformity certificate; they were not named in the regulated categories We found. Requirements for these items are often set by retail buyers. Specific products, such as toys, childcare articles or food-contact items, are regulated separately.",
  "keyPoints": [
   "No general-plastics category found in regulated lists",
   "Retail buyer specifications often apply",
   "Toys, childcare and food-contact items are separate regimes"
  ],
  "confidence": "low",
  "whatToConfirm": "Ask MoIAT or an authorised certification body to confirm your products are outside the regulated list.",
  "sources": [
   {
    "title": "Product conformity: ECAS and EQM certification explained",
    "publisher": "SGS",
    "url": "https://www.sgs.com/en/news/2024/06/pca-2024-q2-navigating-uae-product-conformity-understanding-ecas-and-eqm-certification"
   }
  ]
 },
 "hg.uae.child": {
  "answer": "Yes, extra rules can apply. Toys fall under a regional technical regulation requiring technical documentation, test reports, a declaration of conformity and the regional conformity mark, with the destination's official language labelling. Childcare articles such as feeding bottles, teats, soothers, children's cutlery and diapers are certified under MoIAT's scheme under Cabinet Resolution No. 34 of 2019. Ordinary storage items are not clearly covered.",
  "keyPoints": [
   "regional toy regulation with regional conformity mark",
   "Childcare articles under Cabinet Resolution No. 34 of 2019",
   "the destination's official language labelling for toys"
  ],
  "confidence": "medium",
  "whatToConfirm": "Confirm with a certification body whether your product counts as a toy or childcare article.",
  "sources": [
   {
    "title": "Certification for childcare products authorised",
    "publisher": "SGS",
    "url": "https://www.sgs.com/en-lb/news/2023/11/sgs-authorized-for-childcare-product-certification-in-the-uae"
   },
   {
    "title": "New standards for toys",
    "publisher": "regional News",
    "url": "https://gulfnews.com/uae/government/esma-sets-new-standards-for-toys-1.1429556"
   }
  ]
 },
 "wi.uae.water": {
  "answer": "Yes, very likely. A federal Cabinet resolution (No. 26 of 2013) lists mandatory technical regulations under a drinking-water control system, including a standard for unplasticised PVC pipes for potable water and a separate one for fittings on pressure lines. The water utility may also require its own product approval. We could not check whether the resolution has been amended.",
  "keyPoints": [
   "Cabinet Resolution No. 26 of 2013 (drinking-water control system)",
   "UPVC potable pipes and fittings listed as mandatory regulations",
   "Utility product approval may be separate"
  ],
  "confidence": "medium",
  "whatToConfirm": "Ask the water authority and MoIAT which approvals apply to your pipe material and size range.",
  "sources": [
   {
    "title": "Cabinet resolution annex on drinking-water technical regulations",
    "publisher": "Federal legislation portal",
    "url": "https://uaelegislation.gov.ae/en/legislations/3794/regulations/1429/download"
   }
  ]
 },
 "wi.uae.project": {
  "answer": "Often yes. Large projects usually buy only materials on the approved lists of the project owner or utility, and tenders for plastic pipes and fittings specify standards and approved makes. We found no official approval criteria in my searches, so the process must be confirmed with each authority or consultant.",
  "keyPoints": [
   "Approved-material lists decide who can supply",
   "Tenders specify standards and approved brands",
   "Approval usually runs through the local importer or contractor"
  ],
  "confidence": "low",
  "whatToConfirm": "Ask the contractor or consultant for the project's approved-materials procedure and the utility's supplier approval steps.",
  "sources": [
   {
    "title": "Utility tender and technical specification download",
    "publisher": "Water and electricity utility",
    "url": "https://www.dewa.gov.ae/api/RfxDownload/Get/2012604263"
   }
  ]
 },
 "wi.uae.agri": {
  "answer": "We could not find any official source on agriculture or landscaping authority requirements for irrigation products. Irrigation pipes may still fall under general conformity rules or buyer specifications, but this is unconfirmed.",
  "keyPoints": [
   "No official requirement found",
   "Check conformity rules for pipe categories",
   "Buyer specifications likely apply"
  ],
  "confidence": "low",
  "whatToConfirm": "Ask the buyer and the agriculture or municipal authority whether irrigation products need approval.",
  "sources": []
 },
 "ec.uae.elec": {
  "answer": "Possibly. MoIAT's ECAS covers electrical categories such as low voltage products and cables, but none of the sources We found named conduit. Whether plastic conduit counts as electrical equipment needing conformity assessment is unconfirmed, and utilities or projects may add their own approval.",
  "keyPoints": [
   "ECAS electrical categories include low voltage products and cables",
   "Conduit not named in sources",
   "Certificates issued by authorised bodies, valid one year"
  ],
  "confidence": "low",
  "whatToConfirm": "Ask MoIAT or an authorised certification body whether plastic conduit is a regulated electrical product.",
  "sources": [
   {
    "title": "Product conformity: ECAS and EQM certification explained",
    "publisher": "SGS",
    "url": "https://www.sgs.com/en/news/2024/06/pca-2024-q2-navigating-uae-product-conformity-understanding-ecas-and-eqm-certification"
   },
   {
    "title": "ECAS product certification services",
    "publisher": "TUV SUD",
    "url": "https://www.tuvsud.com/en-ae/services/product-certification/moiat-ecas-product-certification-services-in-uae"
   }
  ]
 },
 "ec.uae.fire": {
  "answer": "Likely for buildings, but We could not confirm the specific rules from an official source. Fire and life-safety codes are enforced by civil defence authorities, and projects often require fire and smoke test evidence for cable-management materials. Requirements depend on building type and the project specification.",
  "keyPoints": [
   "Civil defence authorities enforce fire and life-safety codes",
   "Project specifications often require fire test reports",
   "Low-smoke halogen-free grades may be requested"
  ],
  "confidence": "low",
  "whatToConfirm": "Ask the project consultant or civil defence authority which fire-behaviour standard applies to your building type.",
  "sources": []
 },
 "ec.uae.utility": {
  "answer": "Probably yes. Utilities and project authorities commonly maintain approved material and supplier lists for electrical and cable-management products, and supply is limited to approved makes. We could not find an official approval procedure in my searches, so confirm with each utility.",
  "keyPoints": [
   "Approved material and supplier lists are common",
   "Approvals differ between utilities",
   "Usually handled through the local importer or contractor"
  ],
  "confidence": "low",
  "whatToConfirm": "Ask the target utility or project consultant for its material approval procedure and typical lead time.",
  "sources": [
   {
    "title": "Utility tender and technical specification download",
    "publisher": "Water and electricity utility",
    "url": "https://www.dewa.gov.ae/api/RfxDownload/Get/2012504288"
   }
  ]
 },
 "common.iec": {
  "answer": "Yes. An Importer-Exporter Code (IEC) from DGFT is needed for exporting goods in practice: customs, banks and most schemes key off it. It is issued once with lifetime validity, but advisers report it must be confirmed or updated online every year (April to June) or it can be deactivated.",
  "keyPoints": [
   "10-digit code issued by DGFT",
   "Lifetime validity, annual update reported",
   "Needed for LUT, RCMC and shipping bills",
   "Sources are adviser blogs, not DGFT text"
  ],
  "confidence": "medium",
  "whatToConfirm": "Check the IEC status and update requirement on the DGFT portal or with your customs broker.",
  "sources": [
   {
    "title": "IEC annual update reminder",
    "publisher": "Taxscan",
    "url": "https://www.taxscan.in/top-stories/reminder-for-importers-exporters-dgft-mandates-annual-iec-updation-to-avoid-deactivation-1446526"
   },
   {
    "title": "Is it mandatory to renew an IEC every year",
    "publisher": "Kanakkupillai",
    "url": "https://www.kanakkupillai.com/learn/dgft-iec-code-benefits-and-applicability/"
   }
  ]
 },
 "common.gst": {
  "answer": "Exports are zero-rated for GST. Exporters either ship under a Letter of Undertaking (LUT, no IGST charged, then claim refund of unused input tax credit) or pay IGST and receive an automatic refund after the shipping bill matches the GST returns. The LUT is valid for one financial year.",
  "keyPoints": [
   "LUT filed in Form RFD-11, renewed yearly",
   "IGST-paid route refunds via shipping bill matching",
   "LUT route saves cash tied up in IGST",
   "Eligibility conditions have changed over time"
  ],
  "confidence": "medium",
  "whatToConfirm": "A chartered accountant should confirm which route suits your cash flow and the current LUT eligibility rules.",
  "sources": [
   {
    "title": "Export without payment of IGST: refund",
    "publisher": "Cogoport",
    "url": "https://www.cogoport.com/blogs/gst-refunds-part-1-export-without-payment-of-igst"
   },
   {
    "title": "Export import GST compliances 2026 guide",
    "publisher": "Disytax",
    "url": "https://disytax.com/?p=24916"
   }
  ]
 },
 "common.docs": {
  "answer": "The exporter normally files the shipping bill electronically through a customs broker (CHA) or freight forwarder, using the IEC, GST invoice, packing list and, where relevant, the certificate of origin. Brokers usually charge per shipment. We could not retrieve an official CBIC page on this, so treat the details as general practice.",
  "keyPoints": [
   "Shipping bill filed on the customs system",
   "Typical documents: invoice, packing list, IEC, GST details",
   "Broker or forwarder charges vary",
   "Claims for incentives are linked to the shipping bill"
  ],
  "confidence": "low",
  "whatToConfirm": "Ask your customs broker which documents and fees apply for your port and product.",
  "sources": [
   {
    "title": "Export import GST compliances 2026 guide",
    "publisher": "Disytax",
    "url": "https://disytax.com/?p=24916"
   }
  ]
 },
 "common.rcmc": {
  "answer": "For plastics the relevant body is Plexconcil. Registration-cum-membership certificates are applied for on the DGFT common digital platform using the IEC and a digital signature, and are often needed to claim benefits. Plexconcil FAQs list a new-member fee of about Rs 13,570 including GST for manufacturers and merchants, plus CA turnover certificates.",
  "keyPoints": [
   "Apply via DGFT portal with IEC and DSC",
   "Manufacturers upload Udyam or IEM plus CA turnover certificate",
   "Fee figure is from a Plexconcil FAQ, may be outdated",
   "Renewal fees depend on turnover band"
  ],
  "confidence": "medium",
  "whatToConfirm": "Confirm current fees and documents directly with Plexconcil.",
  "sources": [
   {
    "title": "Plexconcil membership FAQ",
    "publisher": "Plexconcil",
    "url": "https://plexconcil.org/public/custom/files/faq/1775028543.pdf"
   },
   {
    "title": "How to become a Plexconcil member",
    "publisher": "Amazon Global Selling",
    "url": "https://sell.amazon.in/grow-your-business/amazon-global-selling/blogs/plexconcil"
   }
  ]
 },
 "fc.ex.food": {
  "answer": "We found no general Indian export inspection requirement for plastic food-contact articles. Mandatory export inspection applies only to notified products, and the main food-contact checks are usually set by the importing side or the buyer. This could not be confirmed from an official source.",
  "keyPoints": [
   "No specific Indian rule found",
   "Buyer-driven migration testing is common",
   "Check whether any notified inspection applies"
  ],
  "confidence": "low",
  "whatToConfirm": "Ask the Export Inspection Council and Plexconcil whether any export inspection is notified for your product.",
  "sources": []
 },
 "hg.ex.none": {
  "answer": "We found no product-specific Indian export restriction or mandatory inspection for general household plastic articles. The usual checks apply: IEC, GST handling, shipping bill and, if wanted, RCMC. This is an absence of evidence, not a confirmed statement.",
  "keyPoints": [
   "No specific rule found in searches",
   "Common checks still apply",
   "Verify the tariff line is not restricted"
  ],
  "confidence": "low",
  "whatToConfirm": "Check the tariff line in the DGFT export policy (ITC-HS) schedule or with your customs broker.",
  "sources": []
 },
 "wi.ex.none": {
  "answer": "We found no product-specific Indian export restriction for plastic pipes and irrigation products. The usual checks apply: IEC, GST handling, shipping bill and, if wanted, RCMC. This is an absence of evidence, not a confirmed statement.",
  "keyPoints": [
   "No specific rule found in searches",
   "Common checks still apply",
   "Buyer may ask for quality certificates"
  ],
  "confidence": "low",
  "whatToConfirm": "Check the tariff line in the DGFT export policy (ITC-HS) schedule or with your customs broker.",
  "sources": []
 },
 "ec.ex.none": {
  "answer": "We found no product-specific Indian export restriction for plastic conduits and profiles. The usual checks apply: IEC, GST handling, shipping bill and, if wanted, RCMC. This is an absence of evidence, not a confirmed statement.",
  "keyPoints": [
   "No specific rule found in searches",
   "Common checks still apply",
   "Verify tariff line status"
  ],
  "confidence": "low",
  "whatToConfirm": "Check the tariff line in the DGFT export policy (ITC-HS) schedule or with your customs broker.",
  "sources": []
 },
 "common.cepa.rule": {
  "answer": "Reported rule for Chapter 39 plastics articles is a change of tariff sub-heading (CTSH) plus 40% value addition, measured on FOB basis. So it combines a tariff shift with a value test. Plexconcil reported the Commerce Ministry sought views on easing this rule for Chapter 39 at a Joint Committee meeting in November 2025; the outcome was not found.",
  "keyPoints": [
   "CTSH + 40% value addition (reported)",
   "Value test on FOB basis",
   "Possible relaxation under discussion since late 2025",
   "Rule is by tariff line, so the exact HS code matters"
  ],
  "confidence": "medium",
  "whatToConfirm": "Read the product-specific rules annex for your 8-digit line and check for any Joint Committee amendment with Plexconcil or DGFT.",
  "sources": [
   {
    "title": "Plexconcil circular on origin rules for Chapter 39",
    "publisher": "Plexconcil",
    "url": "https://plexconcil.org/public/custom/files/circulars/1784868141.pdf"
   },
   {
    "title": "CEPA signing alert",
    "publisher": "EY India",
    "url": "https://assets.ey.com/content/dam/ey-sites/ey-com/en_in/alerts_pdf/2022/04/india-and-the-uae-sign-comprehensive-economic-partnership-agreement.pdf?download"
   }
  ]
 },
 "common.cepa.inputs": {
  "answer": "Under the reported rule, imported inputs matter twice: they must not leave the product in the same sub-heading as the finished article, and local value addition must reach 40% of FOB value. Imported resin is usually in Chapter 39 itself, so check whether it shifts sub-heading and how much of the price is imported content.",
  "keyPoints": [
   "Work out imported resin and additive cost share",
   "Compare input and product sub-headings",
   "Value addition is on FOB price",
   "Domestic polymer helps"
  ],
  "confidence": "medium",
  "whatToConfirm": "Have a customs or trade adviser run your bill of materials against the annex rule for your tariff line.",
  "sources": [
   {
    "title": "Plexconcil circular on origin rules for Chapter 39",
    "publisher": "Plexconcil",
    "url": "https://plexconcil.org/public/custom/files/circulars/1784868141.pdf"
   }
  ]
 },
 "common.cepa.proof": {
  "answer": "Yes, keep it ready. Issuing agencies and importing customs can ask for supporting records, so maintain a bill of materials, purchase invoices for resin and additives, costing sheet showing value addition, and production records. Exact retention periods and verification practice were not confirmed from an official text.",
  "keyPoints": [
   "Bill of materials per product",
   "Resin and additive purchase invoices and import documents",
   "Costing sheet to FOB price",
   "Production and sales records"
  ],
  "confidence": "low",
  "whatToConfirm": "Check the record-keeping and verification rules in the agreement's origin procedures with DGFT or your adviser.",
  "sources": [
   {
    "title": "CEPA rules of origin and CoO procedure",
    "publisher": "AFLEO",
    "url": "https://afleo.com/india-uae-cepa-coo-dgft/"
   }
  ]
 },
 "common.cepa.cert": {
  "answer": "Preferential certificates of origin are applied for electronically on the DGFT common digital platform (coo.dgft.gov.in) since 1 May 2022, issued by DGFT regional offices and other designated agencies such as chambers or export inspection agencies. One adviser reports 1 to 2 working days. We found no published fee.",
  "keyPoints": [
   "Online application, QR-code verifiable certificate",
   "Issuer depends on product and agency list",
   "1-2 days is an adviser claim",
   "Fee not confirmed"
  ],
  "confidence": "medium",
  "whatToConfirm": "Confirm the issuing agency, fee and filing time limit on the DGFT CoO portal.",
  "sources": [
   {
    "title": "Electronic issuance of preferential certificate of origin",
    "publisher": "StudyCafe summarising DGFT Trade Notice 05/2022-23",
    "url": "https://studycafe.in/dgft-notifies-electronic-filing-issuance-of-preferential-certificate-of-origin-for-exports-under-india-uae-cepa-127552.html"
   },
   {
    "title": "CEPA rules of origin and CoO procedure",
    "publisher": "AFLEO",
    "url": "https://afleo.com/india-uae-cepa-coo-dgft/"
   }
  ]
 },
 "common.rodtep": {
  "answer": "RoDTEP rates and caps are set per tariff line in DGFT appendices 4R and 4RE. A 50% cut was notified on 23 Feb 2026 but withdrawn on 23 Mar 2026 (Notification 66/2025-26), restoring earlier rates. The scheme was then extended to 30 Sep 2026 and, per a secondary report, to 31 Dec 2026 at unchanged rates. We found no plastics-specific rate.",
  "keyPoints": [
   "Cut notified 23 Feb 2026, restored 23 Mar 2026",
   "Extension to 30 Sep 2026 (Notification 74/2025-26)",
   "Further extension to 31 Dec 2026 reported, unconfirmed",
   "Rate depends on your 8-digit tariff line"
  ],
  "confidence": "medium",
  "whatToConfirm": "Check the current DGFT notification and Appendix 4R for your tariff line before quoting any rate.",
  "sources": [
   {
    "title": "DGFT restricts RoDTEP to 50% of rates and caps",
    "publisher": "EY India",
    "url": "https://www.ey.com/en_in/technical/alerts-hub/2026/02/dgft-restricts-rodtep-benefits-to-50pc-of-notified-rates-and-value-caps-on-exported-products"
   },
   {
    "title": "RoDTEP circular",
    "publisher": "Plexconcil",
    "url": "https://plexconcil.org/public/custom/files/circulars/1774347921.pdf"
   }
  ]
 },
 "common.drawback": {
  "answer": "Duty drawback refunds customs duty on imported inputs used in exports, mostly through All Industry Rates set by CBIC per tariff item with value caps, claimed by suffixing the item with B. We could not find the current plastics rate schedule; the latest revisions seen were October 2023 and May 2024. Note drawback and RoDTEP are generally not claimed for the same duty.",
  "keyPoints": [
   "All Industry Rates per tariff item, with caps",
   "Claim on shipping bill using suffix B",
   "Latest schedule not confirmed",
   "Brand-rate route exists for higher actual duty"
  ],
  "confidence": "low",
  "whatToConfirm": "Check the latest CBIC drawback notification and schedule, or ask your customs broker for the rate.",
  "sources": [
   {
    "title": "CBIC circular on revised All Industry Rates",
    "publisher": "India Shipping News",
    "url": "https://indiashippingnews.com/cbic-issued-circular-regarding-the-revision-of-all-industry-rates-airs-of-duty-drawback/"
   }
  ]
 },
 "common.aa": {
  "answer": "Advance Authorisation lets an exporter import inputs such as resin duty-free, subject to an export obligation within a set period and to norms and records. It suits steady exporters with significant imported inputs. We did not retrieve current DGFT rules in this search, so details need checking.",
  "keyPoints": [
   "Duty-free import against export obligation",
   "Needs input-output norms and records",
   "Obligation and compliance risk if unmet"
  ],
  "confidence": "low",
  "whatToConfirm": "Ask DGFT or a trade consultant about current norms for plastic articles and the obligation period.",
  "sources": []
 },
 "common.state": {
  "answer": "Incentives differ by state. Gujarat introduced a Viksit Gujarat Industrial Policy 2026-31 in June 2026 with an export emphasis, and Maharashtra has a State Export Promotion Policy 2023 aimed at MSMEs and clusters. We found no official notification with plastics-specific benefits, so details are unconfirmed.",
  "keyPoints": [
   "Gujarat policy 2026-31 reported June 2026",
   "Maharashtra export policy 2023-28",
   "Benefits and eligibility not confirmed",
   "State industry departments publish the rules"
  ],
  "confidence": "low",
  "whatToConfirm": "Check your state industries department or district industries centre for current eligibility and caps.",
  "sources": [
   {
    "title": "Impact of the 2026 state industrial policy",
    "publisher": "Corpseed",
    "url": "https://www.corpseed.com/law-update/impact-of-gujarat-industrial-policy-2026-on-industries-msmes-and-investors"
   },
   {
    "title": "Parliamentary answer on state export policy",
    "publisher": "Ministry of Commerce and Industry",
    "url": "https://www.commerce.gov.in/wp-content/uploads/2026/02/USQ-1410-PDF.pdf"
   }
  ]
 },
 "fc.test.migration": {
  "answer": "Yes, plan to hold them. The regional standards follow the EU approach: an overall migration limit of 10 mg/dm2 (or 60 mg/kg) plus specific migration limits for listed substances, tested in food simulants. Reports should name the exact resin, colourants and finished article, from an ISO 17025 accredited lab.",
  "keyPoints": [
   "GSO 1863/2013 (plastic packages) cited as 10 mg/dm2 or 60 mg/kg overall limit",
   "EU 10/2011 simulants: 10% ethanol, 3% acetic acid, 95% ethanol; typical 40 C for 10 days",
   "Test the finished colour, not just natural resin"
  ],
  "confidence": "medium",
  "whatToConfirm": "Ask the importer or a GSO-recognised lab which current standard edition and simulants they will accept.",
  "sources": [
   {
    "title": "Regulation of food contact materials in the GSO member states",
    "publisher": "Packaging Law (commentary)",
    "url": "https://www.packaginglaw.com/special-focus/Regulation-Food-Contact-Materials-GCC-Member-States"
   },
   {
    "title": "Plastic regulation (EU) 10/2011 overview",
    "publisher": "Finnish Food Authority (Ruokavirasto)",
    "url": "https://ruokavirasto.fi/en/foodstuffs/food-sector/packages-and-other-food-contact-materials/rules-for-food-contact-materials/plastic-regulation-eu-102011"
   },
   {
    "title": "Plastic packaging migration testing",
    "publisher": "Eurofins",
    "url": "https://eurofins.com/consumer-product-testing/packaging/industries/food-contact-materials/plastic-packaging"
   }
  ]
 },
 "fc.test.grade": {
  "answer": "Yes. Buyers and labs expect a written food-contact declaration from each resin and masterbatch supplier, stating compliance with the EU 10/2011 style positive list or the regional equivalent, any restrictions (simulants, temperature, contact time) and the substances with limits. Keep one per grade and colour.",
  "keyPoints": [
   "EU 10/2011 requires a declaration of compliance with a model in Annex IV",
   "Declaration should list restrictions of use and any substances needing specific migration limits",
   "Keep batch traceability to the declaration"
  ],
  "confidence": "medium",
  "whatToConfirm": "Check with each supplier that declarations cover the destination standard, not only EU or US FDA.",
  "sources": [
   {
    "title": "Plastic regulation (EU) 10/2011 overview",
    "publisher": "Finnish Food Authority (Ruokavirasto)",
    "url": "https://ruokavirasto.fi/en/foodstuffs/food-sector/packages-and-other-food-contact-materials/rules-for-food-contact-materials/plastic-regulation-eu-102011"
   },
   {
    "title": "EU food contact materials testing",
    "publisher": "Intertek",
    "url": "https://www.intertek.com/housewares-home-decor/food-contact-articles-testing/eu-food-contact-materials/"
   },
   {
    "title": "Regulation of food contact materials in the GSO member states",
    "publisher": "Packaging Law (commentary)",
    "url": "https://www.packaginglaw.com/special-focus/Regulation-Food-Contact-Materials-GCC-Member-States"
   }
  ]
 },
 "fc.test.claims": {
  "answer": "Each claim needs its own evidence; none is automatic from food-contact approval. Microwave or dishwasher claims need repeated-cycle and heat tests plus migration testing after those cycles. BPA-free needs a lab test or a material declaration (for example polypropylene has no bisphenol A). Do not print a claim you cannot document.",
  "keyPoints": [
   "Microwave-safe: test migration and deformation after heating",
   "Dishwasher-safe: repeat cycles then check cracking, warping and migration",
   "BPA-free: supplier declaration plus lab test for polycarbonate or copolyester"
  ],
  "confidence": "low",
  "whatToConfirm": "Confirm with the importer which claims their retail buyers audit and what test method they require.",
  "sources": [
   {
    "title": "EU food contact materials testing",
    "publisher": "Intertek",
    "url": "https://www.intertek.com/housewares-home-decor/food-contact-articles-testing/eu-food-contact-materials/"
   },
   {
    "title": "Plastic packaging migration testing",
    "publisher": "Eurofins",
    "url": "https://eurofins.com/consumer-product-testing/packaging/industries/food-contact-materials/plastic-packaging"
   }
  ]
 },
 "fc.test.recycled": {
  "answer": "Treat recycled plastic as not acceptable for food contact unless the importer has confirmed it in writing. The regional rules mirror EU practice, which allows recycled plastic for food contact only from authorised, decontaminating processes. Most buyers expect virgin food-grade resin, and mixed post-consumer regrind usually fails.",
  "keyPoints": [
   "EU practice: recycled plastics only via authorised recycling processes",
   "Own clean in-house production scrap is a different case, but document it",
   "Use virgin food-grade resin if unsure"
  ],
  "confidence": "low",
  "whatToConfirm": "Confirm with the importer and the testing laboratory whether any recycled content is accepted.",
  "sources": [
   {
    "title": "Plastic regulation (EU) 10/2011 overview",
    "publisher": "Finnish Food Authority (Ruokavirasto)",
    "url": "https://ruokavirasto.fi/en/foodstuffs/food-sector/packages-and-other-food-contact-materials/rules-for-food-contact-materials/plastic-regulation-eu-102011"
   },
   {
    "title": "Regulation of food contact materials in the GSO member states",
    "publisher": "Packaging Law (commentary)",
    "url": "https://www.packaginglaw.com/special-focus/Regulation-Food-Contact-Materials-GCC-Member-States"
   }
  ]
 },
 "hg.test.mech": {
  "answer": "Buyers set the tests for their own range, so ask for their specification. Common checks are static load, stacking (top-load over time), drop or impact, and handle or hinge strength. For bins and crates ISO and ASTM drop and stack methods are widely used. Keep reports with sample size, conditions and pass criteria.",
  "keyPoints": [
   "Stacking load held for a set time at a set temperature",
   "Drop or impact at low and room temperature",
   "Handle pull-out and lid latch cycles"
  ],
  "confidence": "low",
  "whatToConfirm": "Get the buyer's written test specification before testing; a general consumer product usually has no mandatory mechanical standard.",
  "sources": [
   {
    "title": "Outdoor furniture testing brochure",
    "publisher": "CATAS",
    "url": "https://catas.com/uploads/media/arredo-esterno-eng.pdf"
   }
  ]
 },
 "hg.test.uv": {
  "answer": "For outdoor use, evidence UV and heat ageing with accelerated weathering. Xenon-arc exposure under ISO 4892-2 (equivalent to ASTM G155) is the usual lab method, with colour change and impact retention measured before and after. UV stabiliser in the formulation should be documented. Buyers often want a stated exposure hours figure.",
  "keyPoints": [
   "ISO 4892-2 xenon-arc, with ISO 4892-1 general guidance",
   "Measure colour shift and impact retention",
   "Carbon-black or UV-stabilised grades perform better"
  ],
  "confidence": "medium",
  "whatToConfirm": "Agree the exposure hours and pass criteria with the buyer.",
  "sources": [
   {
    "title": "ISO 4892-2 xenon-arc exposure of plastics",
    "publisher": "Standards Council of Canada database",
    "url": "https://scc-ccn.ca/standardsdb/standards/8150045"
   }
  ]
 },
 "hg.test.furn": {
  "answer": "Hospitality and contract buyers often ask for strength, durability and stability reports. For outdoor seating and tables the common EU series is EN 581 (general safety, strength, durability; EN 581-2 seating), with stability under EN 1022. Indoor chairs use other EN or ISO series. EN 581 does not cover weathering, so UV is tested separately.",
  "keyPoints": [
   "EN 581-1 general, EN 581-2 seating, EN 1022 seating stability",
   "Test loads based on users up to 110 kg",
   "Flammability is separate and usually only if specified"
  ],
  "confidence": "medium",
  "whatToConfirm": "Ask the buyer which furniture standard and fire test (if any) their project requires.",
  "sources": [
   {
    "title": "EN 581 outdoor furniture general safety",
    "publisher": "BSI via ANSI webstore",
    "url": "https://webstore.ansi.org/standards/bsi/bsen5812006"
   },
   {
    "title": "Outdoor furniture testing brochure",
    "publisher": "CATAS",
    "url": "https://catas.com/uploads/media/arredo-esterno-eng.pdf"
   }
  ]
 },
 "wi.test.pressure": {
  "answer": "Pressure pipe is sold against a named standard. For PE water pipe the common one is ISO 4427 (parts 1, 2, 5), covering dimensions and hydrostatic strength; PVC and PP have their own ISO series. The exact test temperatures and durations are in the standard itself. Hold type-test reports and the material's long-term strength rating (MRS, for example PE80 or PE100).",
  "keyPoints": [
   "ISO 4427-2 pipes, ISO 4427-1 compounds, ISO 4427-5 system fitness",
   "Edition: the 2007 part 2 was reported replaced by a 2019 edition",
   "State PN class and SDR on the report"
  ],
  "confidence": "medium",
  "whatToConfirm": "Confirm the exact standard and edition with the buyer's specification and an accredited lab.",
  "sources": [
   {
    "title": "ISO 4427-2 PE pipes for water supply, scope and status",
    "publisher": "Standards Council of Canada database",
    "url": "https://ccn-scc.ca/standardsdb/standards/8120036"
   }
  ]
 },
 "wi.test.potable": {
  "answer": "Yes if the pipe or tank carries drinking water. Buyers typically ask for a material approval from a recognised drinking-water scheme, such as those used in Europe, the UK or North America, plus resin supplier declarations. ISO 4427-2 itself covers pipes for water for human consumption, but the approval for the material is separate.",
  "keyPoints": [
   "ISO 4427-2 scope includes water for human consumption",
   "Approval is for the compound or product, not just the standard",
   "Project approval lists may require local registration"
  ],
  "confidence": "low",
  "whatToConfirm": "Ask the buyer and the local water authority which approval scheme they recognise before testing.",
  "sources": [
   {
    "title": "ISO 4427-2 PE pipes for water supply, scope and status",
    "publisher": "Standards Council of Canada database",
    "url": "https://ccn-scc.ca/standardsdb/standards/8120036"
   }
  ]
 },
 "wi.test.uv": {
  "answer": "Outdoor and irrigation products should show UV resistance (carbon black content and dispersion for black pipe, or stabilised colour) and chlorine or disinfectant resistance. Common methods are xenon-arc weathering under ISO 4892-2 and oxidation induction time tests. Chlorine resistance for pipe is commonly evidenced under ISO 4427-aligned or buyer-specified tests.",
  "keyPoints": [
   "ISO 4892-2 xenon-arc for weathering",
   "Carbon black 2 to 2.5 percent typical for black PE",
   "Chlorine resistance test as specified by buyer"
  ],
  "confidence": "low",
  "whatToConfirm": "Agree acceptance values with the buyer; no single universal figure was confirmed.",
  "sources": [
   {
    "title": "ISO 4892-2 xenon-arc exposure of plastics",
    "publisher": "Standards Council of Canada database",
    "url": "https://scc-ccn.ca/standardsdb/standards/8150045"
   }
  ]
 },
 "wi.test.third": {
  "answer": "Often yes for tenders and drinking-water or utility projects, and rarely for general retail. Third-party certification means an independent body audits your factory and tests samples on a recurring basis. It adds weeks of lead time and annual fees. Ask early which marks the buyer accepts.",
  "keyPoints": [
   "Scheme audit of factory plus type tests",
   "Annual surveillance testing",
   "Project approval lists may be separate"
  ],
  "confidence": "low",
  "whatToConfirm": "Ask the importer or end client which certification mark they require.",
  "sources": [
   {
    "title": "ISO 4427-2 PE pipes for water supply, scope and status",
    "publisher": "Standards Council of Canada database",
    "url": "https://ccn-scc.ca/standardsdb/standards/8120036"
   }
  ]
 },
 "ec.test.mech": {
  "answer": "Conduit is bought to a stated specification; the common international series is IEC 61386 (general part -1, with rigid -21, pliable -22 and flexible -23). It classifies compression and impact resistance and temperature range, and tests them. Hold reports for the class you claim.",
  "keyPoints": [
   "IEC 61386-1 general requirements",
   "Compression and impact classes with lower and upper temperature",
   "Particular parts -21, -22, -23 by conduit type"
  ],
  "confidence": "medium",
  "whatToConfirm": "Confirm with the buyer which edition and classification codes they specify.",
  "sources": [
   {
    "title": "IEC 61386-1 conduit systems, general requirements (preview)",
    "publisher": "VDE Verlag",
    "url": "https://www.vde-verlag.de/iec-normen/preview-pdf/info_iec61386-1{ed2.0}b.pdf"
   },
   {
    "title": "IEC 61386 compliance inspection checklist",
    "publisher": "Electrical Trader (trade guide)",
    "url": "https://electricaltrader.com/blogs/news/iec-61386-compliance-inspection-checklist"
   }
  ]
 },
 "ec.test.fire": {
  "answer": "Hold reports for resistance to flame propagation, which IEC 61386-1 includes as a clause. PVC is self-extinguishing but gives halogen smoke, so some projects ask for halogen-free, low-smoke grades with separate test standards. Reaction-to-fire needs depend on the building type and the project specification.",
  "keyPoints": [
   "IEC 61386-1 flame propagation test",
   "Halogen-free low-smoke grades tested to separate smoke and acidity methods",
   "Building type drives requirement"
  ],
  "confidence": "low",
  "whatToConfirm": "Ask the buyer and project consultant which fire and smoke tests are specified.",
  "sources": [
   {
    "title": "IEC 61386-1 conduit systems, general requirements (preview)",
    "publisher": "VDE Verlag",
    "url": "https://www.vde-verlag.de/iec-normen/preview-pdf/info_iec61386-1{ed2.0}b.pdf"
   }
  ]
 },
 "ec.test.dim": {
  "answer": "Yes. For custom profiles, record a dimensional inspection report against the buyer's drawing, with the measured dimensions, tolerance bands, sample count and gauge or calliper used. Include straightness, wall thickness and cut length where relevant. Keep first-article approval signed by the buyer.",
  "keyPoints": [
   "First-article inspection report",
   "Tolerances per drawing or ISO 3126 style pipe dimension measurement",
   "Sampling plan per batch"
  ],
  "confidence": "low",
  "whatToConfirm": "Agree tolerances and the sampling plan in writing with the buyer.",
  "sources": [
   {
    "title": "IEC 61386-1 conduit systems, general requirements (preview)",
    "publisher": "VDE Verlag",
    "url": "https://www.vde-verlag.de/iec-normen/preview-pdf/info_iec61386-1{ed2.0}b.pdf"
   }
  ]
 },
 "fc.pack.label": {
  "answer": "Expect product name, material, manufacturer and country of origin, with the destination's official language alongside English on retail packs. GSO rules on food-contact packaging require food-contact marking, and regional labelling rules generally require the destination's official language text. The exact content and the destination's official language wording should be confirmed with the importer.",
  "keyPoints": [
   "the destination's official language plus English is the safe default",
   "Country of origin and manufacturer name",
   "Food-contact symbol or statement"
  ],
  "confidence": "low",
  "whatToConfirm": "Have the importer or a customs broker confirm label content and the destination's official language translation before printing.",
  "sources": [
   {
    "title": "Regulation of food contact materials in the GSO member states",
    "publisher": "Packaging Law (commentary)",
    "url": "https://www.packaginglaw.com/special-focus/Regulation-Food-Contact-Materials-GCC-Member-States"
   }
  ]
 },
 "fc.pack.symbol": {
  "answer": "Likely yes. GSO 1863/2013 is reported to require the glass-and-fork symbol on plastic packages in direct food contact, as in the EU. Where the use is not obvious, add the symbol or a statement such as suitable for food contact. Confirm size and placement.",
  "keyPoints": [
   "Glass-and-fork symbol is the EU-style mark",
   "Reported in GSO 1863/2013 item 8.1 by a commentary",
   "Not needed if the product is plainly cutlery or a food container"
  ],
  "confidence": "medium",
  "whatToConfirm": "Confirm the current standard text with the importer or a GSO document.",
  "sources": [
   {
    "title": "Regulation of food contact materials in the GSO member states",
    "publisher": "Packaging Law (commentary)",
    "url": "https://www.packaginglaw.com/special-focus/Regulation-Food-Contact-Materials-GCC-Member-States"
   }
  ]
 },
 "fc.pack.print": {
  "answer": "Yes, this matters. If printed or decorated surfaces touch food, inks and decoration are part of the migration evidence. Prefer in-mould labels or print on the non-contact outer surface, and use inks from suppliers who issue food-contact statements. Test the decorated article, not only the plain resin.",
  "keyPoints": [
   "Print on the non-contact side where possible",
   "Ink supplier food-contact declaration",
   "Migration test on decorated sample"
  ],
  "confidence": "medium",
  "whatToConfirm": "Confirm with the lab which decorated samples are needed.",
  "sources": [
   {
    "title": "Plastic regulation (EU) 10/2011 overview",
    "publisher": "Finnish Food Authority (Ruokavirasto)",
    "url": "https://ruokavirasto.fi/en/foodstuffs/food-sector/packages-and-other-food-contact-materials/rules-for-food-contact-materials/plastic-regulation-eu-102011"
   },
   {
    "title": "Plastic packaging migration testing",
    "publisher": "Eurofins",
    "url": "https://eurofins.com/consumer-product-testing/packaging/industries/food-contact-materials/plastic-packaging"
   }
  ]
 },
 "hg.pack.label": {
  "answer": "Carton and product marking commonly includes product name, material, manufacturer, country of origin, quantity and batch. the destination's official language alongside English is the usual expectation in the regional market. Exact content differs by product, so ask the importer for their label brief.",
  "keyPoints": [
   "the destination's official language plus English",
   "Country of origin",
   "Carton marks: quantity, weight, batch"
  ],
  "confidence": "low",
  "whatToConfirm": "Confirm label content and language with the importer before printing cartons.",
  "sources": [
   {
    "title": "Regulation of food contact materials in the GSO member states",
    "publisher": "Packaging Law (commentary)",
    "url": "https://www.packaginglaw.com/special-focus/Regulation-Food-Contact-Materials-GCC-Member-States"
   }
  ]
 },
 "hg.pack.pallet": {
  "answer": "Yes, solid wood pallets or crates crossing borders should carry the ISPM 15 mark. The mark shows the country code, the producer code and the treatment code, for example HT for heat treatment (core 56 C for at least 30 minutes). Only licensed providers can apply it. Plastic or composite pallets are exempt.",
  "keyPoints": [
   "ISPM 15 mark: country, producer code, treatment (HT or MB)",
   "Heat treatment: 56 C core for 30 minutes",
   "Plywood, OSB and plastic are outside scope"
  ],
  "confidence": "medium",
  "whatToConfirm": "Confirm with the national plant protection authority and the importer that no extra wood-packaging rules apply.",
  "sources": [
   {
    "title": "ISPM 15 guide to wood packaging marking",
    "publisher": "IPP Pooling (trade guide)",
    "url": "https://www.ipp-pooling.com/news/ispm-15-the-ipp-guide/"
   },
   {
    "title": "IPPC pallet markings and their meaning",
    "publisher": "SRS (trade guide)",
    "url": "https://www.srs-i.com/blog/ippc-pallet-markings-meaning/"
   }
  ]
 },
 "hg.pack.nest": {
  "answer": "Usually yes, and it is worth designing for. Nestable or stackable shapes cut carton volume and freight cost sharply. Check the nesting ratio, the effect on carton size and whether nested units scuff or stick. Test a nested stack in a carton drop test.",
  "keyPoints": [
   "Measure units per carton and per container",
   "Check nested units separate cleanly",
   "Carton drop test"
  ],
  "confidence": "medium",
  "whatToConfirm": "Run the packaging design through the freight calculator with the forwarder.",
  "sources": [
   {
    "title": "Outdoor furniture testing brochure",
    "publisher": "CATAS",
    "url": "https://catas.com/uploads/media/arredo-esterno-eng.pdf"
   }
  ]
 },
 "wi.pack.coil": {
  "answer": "Pipe is typically supplied in coils for small diameters and straight lengths or bundles for larger ones. Coils save freight volume but are limited by diameter and wall thickness. Bundle lengths must fit the container (about 5.9 m or 12 m usable lengths). Ask the buyer for coil length and bundle strapping needs.",
  "keyPoints": [
   "Coils for small diameters",
   "Straight lengths up to container length",
   "Nest smaller pipes inside larger ones"
  ],
  "confidence": "low",
  "whatToConfirm": "Agree coil or length format with the buyer and the forwarder.",
  "sources": [
   {
    "title": "ISO 4427-2 PE pipes for water supply, scope and status",
    "publisher": "Standards Council of Canada database",
    "url": "https://ccn-scc.ca/standardsdb/standards/8120036"
   }
  ]
 },
 "wi.pack.mark": {
  "answer": "Pressure pipe is normally marked at intervals along the pipe, with manufacturer, material and grade, nominal size and wall thickness, pressure class (PN or SDR), the standard number and production date or batch. ISO 4427 requires such marking for PE water pipe. Use durable ink or hot embossing.",
  "keyPoints": [
   "Manufacturer, size, PN, SDR, material",
   "Standard reference (for example ISO 4427)",
   "Batch or date code for traceability"
  ],
  "confidence": "medium",
  "whatToConfirm": "Check the exact marking list in the standard and the buyer's specification.",
  "sources": [
   {
    "title": "ISO 4427-2 PE pipes for water supply, scope and status",
    "publisher": "Standards Council of Canada database",
    "url": "https://ccn-scc.ca/standardsdb/standards/8120036"
   }
  ]
 },
 "ec.pack.length": {
  "answer": "Conduit lengths and bundling decide container loading. IEC 61386 rigid conduit is commonly supplied in 3 m lengths, bundled, with end caps. Check bundle weight, pallet size and how many metres fit per container. Fixed lengths that fit the container end to end avoid wasted space.",
  "keyPoints": [
   "Common length 3 m (check buyer)",
   "Bundle strapping and end caps",
   "Metres per container for the freight calculation"
  ],
  "confidence": "low",
  "whatToConfirm": "Confirm lengths and bundle sizes with the buyer and forwarder.",
  "sources": [
   {
    "title": "IEC 61386-1 conduit systems, general requirements (preview)",
    "publisher": "VDE Verlag",
    "url": "https://www.vde-verlag.de/iec-normen/preview-pdf/info_iec61386-1{ed2.0}b.pdf"
   }
  ]
 },
 "ec.pack.mark": {
  "answer": "IEC 61386-1 includes marking and documentation requirements. Expect manufacturer name or mark, product reference, standard and classification code, and often a colour code or batch. A trade guide says marking is repeated every 1 to 3 m and tested for durability, but check the standard text.",
  "keyPoints": [
   "IEC 61386-1 marking clause",
   "Classification code and batch",
   "Repeat interval about 1 to 3 m (secondary source)"
  ],
  "confidence": "medium",
  "whatToConfirm": "Check marking details in the standard and the buyer's specification.",
  "sources": [
   {
    "title": "IEC 61386-1 conduit systems, general requirements (preview)",
    "publisher": "VDE Verlag",
    "url": "https://www.vde-verlag.de/iec-normen/preview-pdf/info_iec61386-1{ed2.0}b.pdf"
   },
   {
    "title": "IEC 61386 compliance inspection checklist",
    "publisher": "Electrical Trader (trade guide)",
    "url": "https://electricaltrader.com/blogs/news/iec-61386-compliance-inspection-checklist"
   }
  ]
 },
 "fc.hs.which": {
  "answer": "Under GRI 1, plastic containers designed for packing or conveying goods go to 3923; articles for table, kitchen or household use go to 3924. A food storage box with a lid is usually 3924 (household kitchenware); a bottle, tub or tray sold as packaging of goods is 3923. Customs brokers decide the national line.",
  "keyPoints": [
   "3923: packing or conveyance articles, stoppers, lids, caps",
   "3924: tableware, kitchenware, other household articles",
   "Customs rulings differ by country and are not binding elsewhere"
  ],
  "confidence": "medium",
  "whatToConfirm": "Have a customs broker confirm the 6-digit heading and the national 8 or 10 digit line, or seek an advance ruling.",
  "sources": [
   {
    "title": "Ruling on plastic storage boxes, headings 3924 vs 3926",
    "publisher": "U.S. Customs and Border Protection (non-binding elsewhere)",
    "url": "https://open-gov.usebase.io/rulings/N311421"
   },
   {
    "title": "Ruling on plastic food boxes, heading 3923",
    "publisher": "U.S. Customs and Border Protection (non-binding elsewhere)",
    "url": "https://open-gov.usebase.io/rulings/084064"
   }
  ]
 },
 "hg.hs.which": {
  "answer": "Under GRI 1, household articles go to 3924 (buckets, dustbins, watering cans, boxes for household use). General storage boxes not designed for household use may fall to 3926 (other articles of plastics), as one customs ruling held. Plastic furniture goes to 9403, and Chapter 39 excludes it. Pallets for goods are usually 3923 or 3926. Classification follows GRI 1 (heading text and section or chapter notes), then GRI 6 for subheadings. The destination applies 8 or 10 digit national lines built on the 6-digit HS.",
  "keyPoints": [
   "3924: household articles (buckets, bins)",
   "3926: residual other articles",
   "9403: other furniture",
   "Industrial pallets usually 3923 or 3926"
  ],
  "confidence": "medium",
  "whatToConfirm": "A customs broker should confirm the heading and national line, using the product's use and design.",
  "sources": [
   {
    "title": "Ruling on plastic storage boxes, headings 3924 vs 3926",
    "publisher": "U.S. Customs and Border Protection (non-binding elsewhere)",
    "url": "https://open-gov.usebase.io/rulings/N311421"
   }
  ]
 },
 "wi.hs.which": {
  "answer": "Under GRI 1, plastic tubes, pipes, hoses and their fittings (elbows, couplings, tees) go to 3917. Water tanks and reservoirs over 300 litres, and other builders' ware, go to 3925. Smaller tanks and containers fall to 3923 or 3926. Drip irrigation tubing is usually 3917. Broker to confirm.",
  "keyPoints": [
   "3917: tubes, pipes, hoses, fittings",
   "3925: builders' ware including tanks above 300 L",
   "Smaller tanks: 3923 or 3926"
  ],
  "confidence": "medium",
  "whatToConfirm": "A customs broker should confirm the heading and the national 8 or 10 digit line.",
  "sources": [
   {
    "title": "Ruling on plastic storage boxes, headings 3924 vs 3926",
    "publisher": "U.S. Customs and Border Protection (non-binding elsewhere)",
    "url": "https://open-gov.usebase.io/rulings/N311421"
   }
  ]
 },
 "ec.hs.which": {
  "answer": "Under GRI 1, round conduit and pipe go to 3917, with fittings. Open or closed profile shapes cut to length and not worked beyond surface treatment go to 3916 (rods, sticks and profile shapes). Cable trunking or finished builders' ware, for example door or window frames, may go to 3925. Form and function decide, so a broker should confirm.",
  "keyPoints": [
   "3917: tubes and pipes, fittings",
   "3916: profile shapes and rods",
   "3925: finished builders' ware"
  ],
  "confidence": "medium",
  "whatToConfirm": "A customs broker should confirm the heading and the national 8 or 10 digit line.",
  "sources": [
   {
    "title": "Ruling on plastic storage boxes, headings 3924 vs 3926",
    "publisher": "U.S. Customs and Border Protection (non-binding elsewhere)",
    "url": "https://open-gov.usebase.io/rulings/N311421"
   }
  ]
 }
};

export const hasResearch = (itemId: string) => itemId in RESEARCH;
