import type { Dictionary } from "../translate.ts";

/**
 * Hindi and Gujarati for the "site" section: the public header menu, the "Services by department" section and the AI scheme finder
 * section of the landing page (and the text in src/lib/landing/*). Keyed by the English source string. Words shared with other screens
 * live in core.ts; terms follow docs/i18n-glossary.md. Each row is [English, Hindi, Gujarati]. {placeholders} are kept exactly.
 * Technical tokens (HS, CEPA, RoDTEP, DGFT, CBIC, UAE, numbers) are never translated.
 */
const ROWS: [string, string, string][] = [
  // Header menu
  ["Open menu", "मेनू खोलें", "મેનૂ ખોલો"],
  ["Departments", "विभाग", "વિભાગો"],
  ["Services by department", "विभाग के अनुसार सेवाएँ", "વિભાગ મુજબ સેવાઓ"],
  ["Choose a department to see its services.", "किसी विभाग की सेवाएँ देखने के लिए उसे चुनें।", "કોઈ વિભાગની સેવાઓ જોવા માટે તેને પસંદ કરો."],

  // Department titles and summaries
  ["Schemes & benefits", "योजनाएँ और लाभ", "યોજનાઓ અને લાભ"],
  ["Execution", "क्रियान्वयन", "અમલીકરણ"],
  ["Find out what your factory could make and where it could sell.", "जानें कि आपकी फ़ैक्टरी क्या बना सकती है और कहाँ बिक सकती है।", "જાણો કે તમારી ફેક્ટરી શું બનાવી શકે અને ક્યાં વેચાઈ શકે."],
  ["Know what a shipment really costs before you quote.", "कोटेशन देने से पहले जानें कि एक शिपमेंट की असली लागत क्या है।", "ક્વોટેશન આપતા પહેલાં જાણો કે એક શિપમેન્ટનો ખરો ખર્ચ કેટલો છે."],
  ["See what to check before the goods leave, in plain language.", "माल निकलने से पहले क्या जाँचना है, सरल भाषा में देखें।", "માલ નીકળતા પહેલાં શું તપાસવું, સરળ ભાષામાં જુઓ."],
  ["AI reads your product and destination and shows the schemes worth checking.", "एआई आपका उत्पाद और गंतव्य पढ़कर जाँचने लायक योजनाएँ दिखाता है।", "એઆઈ તમારું ઉત્પાદન અને ગંતવ્ય વાંચીને તપાસવા લાયક યોજનાઓ બતાવે છે."],
  ["Drafts of the paperwork, and a check for what is missing.", "कागज़ात के ड्राफ़्ट, और जाँच कि क्या छूट रहा है।", "કાગળોના ડ્રાફ્ટ, અને શું બાકી છે તેની તપાસ."],
  ["Run the whole journey, with help when you need it.", "पूरी यात्रा चलाएँ, ज़रूरत पड़ने पर मदद के साथ।", "આખી સફર ચલાવો, જરૂર પડે ત્યારે મદદ સાથે."],

  // Discover
  ["Opportunity finder", "अवसर खोजक", "તક શોધક"],
  ["What else your factory could make, from your processes and materials.", "आपकी प्रक्रियाओं और सामग्री से आपकी फ़ैक्टरी और क्या बना सकती है।", "તમારી પ્રક્રિયાઓ અને સામગ્રીથી તમારી ફેક્ટરી બીજું શું બનાવી શકે."],
  ["Factory-to-World map", "फ़ैक्टरी से दुनिया तक का नक्शा", "ફેક્ટરીથી દુનિયા સુધીનો નકશો"],
  ["See how what you can do leads to products and markets.", "देखें कि आप जो कर सकते हैं वह उत्पादों और बाज़ारों तक कैसे ले जाता है।", "જુઓ કે તમે જે કરી શકો છો તે ઉત્પાદનો અને બજારો સુધી કેવી રીતે લઈ જાય છે."],
  ["Reported destination trade values, always labelled with their source.", "गंतव्य के बताए गए व्यापार मूल्य, हमेशा स्रोत के लेबल के साथ।", "ગંતવ્યના જણાવાયેલા વેપાર મૂલ્યો, હંમેશા સ્રોતના લેબલ સાથે."],
  ["Machine and product recognition", "मशीन और उत्पाद की पहचान", "મશીન અને ઉત્પાદનની ઓળખ"],
  ["Upload a photo and Atlas suggests what it shows, for you to confirm.", "फ़ोटो अपलोड करें और Atlas सुझाता है कि उसमें क्या है, आपकी पुष्टि के लिए।", "ફોટો અપલોડ કરો અને Atlas સૂચવે છે કે તેમાં શું છે, તમારી ખાતરી માટે."],

  // Economics
  ["Cost to land your product at the buyer, line by line, with margin.", "आपके उत्पाद को खरीदार तक पहुँचाने की लागत, मद-दर-मद, मार्जिन के साथ।", "તમારું ઉત્પાદન ખરીદદાર સુધી પહોંચાડવાનો ખર્ચ, બાબત-દર-બાબત, માર્જિન સાથે."],
  ["Freight, handling and insurance ranges, with the sources they came from.", "भाड़ा, हैंडलिंग और बीमा की सीमाएँ, उनके स्रोतों के साथ।", "માલભાડું, હેન્ડલિંગ અને વીમાની શ્રેણીઓ, તેમના સ્રોતો સાથે."],
  ["What-If studio", "व्हाट-इफ़ स्टूडियो", "વૉટ-ઇફ સ્ટુડિયો"],
  ["Change cost, freight, quantity or price and watch the result move.", "लागत, भाड़ा, मात्रा या कीमत बदलें और नतीजा बदलते देखें।", "ખર્ચ, માલભાડું, જથ્થો કે કિંમત બદલો અને પરિણામ બદલાતું જુઓ."],
  ["Put two or more versions side by side.", "दो या अधिक संस्करण साथ-साथ रखें।", "બે કે વધુ આવૃત્તિઓ સાથે-સાથે મૂકો."],

  // Compliance
  ["Requirement screening", "आवश्यकताओं की जाँच-सूची", "જરૂરિયાતોની તપાસ-યાદી"],
  ["Questions to settle for your product family, not rulings.", "आपके उत्पाद वर्ग के लिए तय करने वाले सवाल, कोई फ़ैसला नहीं।", "તમારા ઉત્પાદન વર્ગ માટે નક્કી કરવાના પ્રશ્નો, કોઈ ચુકાદો નહીં."],
  ["Testing and certification gaps", "परीक्षण और प्रमाणन की कमियाँ", "પરીક્ષણ અને પ્રમાણનની ખૂટતી બાબતો"],
  ["Which evidence a buyer or authority may ask for, and what you hold.", "खरीदार या प्राधिकरण कौन-सा प्रमाण माँग सकता है, और आपके पास क्या है।", "ખરીદદાર કે સત્તામંડળ કયો પુરાવો માંગી શકે, અને તમારી પાસે શું છે."],
  ["HS code helper", "HS कोड सहायक", "HS કોડ સહાયક"],
  ["A rule-based starting point, not an official classification.", "नियमों पर आधारित शुरुआती बिंदु, आधिकारिक वर्गीकरण नहीं।", "નિયમો પર આધારિત શરૂઆતનો મુદ્દો, સત્તાવાર વર્ગીકરણ નહીં."],
  ["AI research answers", "एआई शोध उत्तर", "એઆઈ સંશોધન જવાબો"],
  ["Drafted answers with sources and what to confirm.", "स्रोतों और पुष्टि की बातों के साथ तैयार उत्तर।", "સ્રોતો અને ખાતરી કરવાની બાબતો સાથે તૈયાર જવાબો."],

  // Schemes & benefits
  ["AI scheme finder", "एआई योजना खोजक", "એઆઈ યોજના શોધક"],
  ["Reads your product and destination, shows the schemes worth checking and why.", "आपका उत्पाद और गंतव्य पढ़कर जाँचने लायक योजनाएँ और कारण दिखाता है।", "તમારું ઉત્પાદન અને ગંતવ્ય વાંચીને તપાસવા લાયક યોજનાઓ અને કારણ બતાવે છે."],
  ["CEPA origin check", "CEPA मूल की जाँच", "CEPA મૂળની તપાસ"],
  ["Questions on whether your product could meet the trade-agreement origin rules.", "सवाल कि क्या आपका उत्पाद व्यापार समझौते के मूल नियम पूरे कर सकता है।", "પ્રશ્નો કે શું તમારું ઉત્પાદન વેપાર કરારના મૂળ નિયમો પૂરા કરી શકે."],
  ["RoDTEP and duty drawback", "RoDTEP और ड्यूटी ड्रॉबैक", "RoDTEP અને ડ્યુટી ડ્રોબેક"],
  ["What to ask about refunds of embedded taxes and duties.", "शामिल करों और शुल्कों की वापसी के बारे में क्या पूछना है।", "સમાયેલા કરો અને ડ્યુટીના રિફંડ વિશે શું પૂછવું."],
  ["Advance Authorisation", "एडवांस ऑथराइज़ेशन", "એડવાન્સ ઓથોરાઇઝેશન"],
  ["Whether duty-free imports of inputs against an export obligation could suit you.", "क्या निर्यात दायित्व के बदले कच्चे माल का शुल्क-मुक्त आयात आपके लिए उपयुक्त हो सकता है।", "શું નિકાસ જવાબદારી સામે કાચા માલની ડ્યુટી-મુક્ત આયાત તમને અનુકૂળ આવી શકે."],
  ["State incentives", "राज्य प्रोत्साहन", "રાજ્ય પ્રોત્સાહનો"],
  ["Pointers to the state-level schemes to look up for your location.", "आपके स्थान के लिए देखने लायक राज्य-स्तरीय योजनाओं के संकेत।", "તમારા સ્થળ માટે જોવા લાયક રાજ્ય-સ્તરની યોજનાઓના સંકેતો."],

  // Documents
  ["Commercial invoice draft", "कमर्शियल इनवॉइस ड्राफ़्ट", "કોમર્શિયલ ઇનવૉઇસ ડ્રાફ્ટ"],
  ["Filled from your product and shipment details.", "आपके उत्पाद और शिपमेंट के ब्यौरे से भरा गया।", "તમારા ઉત્પાદન અને શિપમેન્ટની વિગતોથી ભરાયેલ."],
  ["Packing list draft", "पैकिंग लिस्ट ड्राफ़्ट", "પેકિંગ લિસ્ટ ડ્રાફ્ટ"],
  ["Cartons, weights and volumes laid out for the shipment.", "शिपमेंट के लिए कार्टन, वज़न और आयतन सजाए गए।", "શિપમેન્ટ માટે કાર્ટન, વજન અને કદ ગોઠવાયેલ."],
  ["Document checklist", "दस्तावेज़ चेकलिस्ट", "દસ્તાવેજ ચેકલિસ્ટ"],
  ["The papers a shipment like yours usually needs.", "आपके जैसे शिपमेंट को आमतौर पर जो कागज़ चाहिए।", "તમારા જેવા શિપમેન્ટને સામાન્ય રીતે જે કાગળો જોઈએ."],
  ["Missing-document check", "छूटे दस्तावेज़ों की जाँच", "ખૂટતા દસ્તાવેજોની તપાસ"],
  ["What is still not ready before you ship.", "भेजने से पहले क्या अभी तैयार नहीं है।", "મોકલતા પહેલાં હજી શું તૈયાર નથી."],

  // Execution
  ["Journey map and task board: every step and what is blocking you.", "यात्रा नक्शा और कार्य बोर्ड: हर कदम और क्या रुकावट है।", "સફરનો નકશો અને કાર્ય બોર્ડ: દરેક પગલું અને શું અવરોધ છે."],
  ["Expert assistance briefs", "विशेषज्ञ सहायता ब्रीफ़", "નિષ્ણાત સહાય બ્રીફ"],
  ["A ready brief to hand to an adviser or broker.", "सलाहकार या ब्रोकर को देने के लिए तैयार ब्रीफ़।", "સલાહકાર કે બ્રોકરને આપવા માટે તૈયાર બ્રીફ."],
  ["Atlas AI assistant", "Atlas एआई सहायक", "Atlas એઆઈ સહાયક"],
  ["Ask questions and have tasks and drafts prepared. You approve before anything is saved.", "सवाल पूछें और कार्य व ड्राफ़्ट तैयार करवाएँ। कुछ भी सहेजने से पहले आप मंज़ूरी देते हैं।", "પ્રશ્નો પૂછો અને કાર્યો તથા ડ્રાફ્ટ તૈયાર કરાવો. કંઈપણ સાચવતા પહેલાં તમે મંજૂરી આપો છો."],
  ["Set up by chatting", "चैट करके सेट अप करें", "ચેટ કરીને સેટ અપ કરો"],
  ["Answer questions and the form fills itself.", "सवालों के जवाब दें और फ़ॉर्म अपने आप भर जाता है।", "પ્રશ્નોના જવાબ આપો અને ફૉર્મ આપોઆપ ભરાઈ જાય છે."],

  // Services section
  ["What Atlas does", "Atlas क्या करता है", "Atlas શું કરે છે"],
  ["Six departments, one workspace. Market data, regulatory facts and scheme rules are researched drafts: confirm them with people before you act. Nothing here is an official approval.", "छह विभाग, एक वर्कस्पेस। बाज़ार डेटा, नियामक तथ्य और योजना के नियम शोध से बने ड्राफ़्ट हैं: कुछ करने से पहले लोगों से पुष्टि करें। यहाँ कुछ भी आधिकारिक मंज़ूरी नहीं है।", "છ વિભાગ, એક વર્કસ્પેસ. બજાર ડેટા, નિયમનકારી તથ્યો અને યોજનાના નિયમો સંશોધનથી બનેલા ડ્રાફ્ટ છે: કંઈ કરતા પહેલાં લોકો પાસે ખાતરી કરો. અહીં કંઈપણ સત્તાવાર મંજૂરી નથી."],
  ["Researched draft", "शोध से बना ड्राफ़्ट", "સંશોધનથી બનેલો ડ્રાફ્ટ"],

  // AI scheme finder section
  ["AI reads your product and tells you which government schemes are worth checking", "एआई आपका उत्पाद पढ़कर बताता है कि कौन-सी सरकारी योजनाएँ जाँचने लायक हैं", "એઆઈ તમારું ઉત્પાદન વાંચીને જણાવે છે કે કઈ સરકારી યોજનાઓ તપાસવા લાયક છે"],
  ["Tell us your product", "हमें अपना उत्पाद बताएँ", "અમને તમારું ઉત્પાદન જણાવો"],
  ["Describe it, speak it, or upload a photo. Atlas reads what it is made of and what it is used for.", "उसे लिखें, बोलें या फ़ोटो अपलोड करें। Atlas पढ़ता है कि वह किससे बना है और किस काम आता है।", "તેને લખો, બોલો કે ફોટો અપલોડ કરો. Atlas વાંચે છે કે તે શાનાથી બનેલું છે અને શેના કામમાં આવે છે."],
  ["Tell us where you want to export", "हमें बताएँ कि आप कहाँ निर्यात करना चाहते हैं", "અમને જણાવો કે તમે ક્યાં નિકાસ કરવા માંગો છો"],
  ["Pick the destination market. The schemes and trade-agreement benefits that matter depend on it.", "गंतव्य बाज़ार चुनें। कौन-सी योजनाएँ और व्यापार-समझौते के लाभ मायने रखते हैं, यह उसी पर निर्भर है।", "ગંતવ્ય બજાર પસંદ કરો. કઈ યોજનાઓ અને વેપાર-કરારના લાભ મહત્વના છે તે તેના પર આધાર રાખે છે."],
  ["See the schemes worth checking", "जाँचने लायक योजनाएँ देखें", "તપાસવા લાયક યોજનાઓ જુઓ"],
  ["Indian export schemes and trade-agreement benefits likely to be relevant, with why, what to confirm and the sources.", "संभवतः प्रासंगिक भारतीय निर्यात योजनाएँ और व्यापार-समझौते के लाभ, कारण, पुष्टि की बातों और स्रोतों के साथ।", "સંભવતઃ સુસંગત ભારતીય નિકાસ યોજનાઓ અને વેપાર-કરારના લાભ, કારણ, ખાતરીની બાબતો અને સ્રોતો સાથે."],
  ["Try it with a sample product", "नमूना उत्पाद के साथ आज़माएँ", "નમૂના ઉત્પાદન સાથે અજમાવો"],
  ["Where to export", "कहाँ निर्यात करना है", "ક્યાં નિકાસ કરવું છે"],
  ["United Arab Emirates (live)", "संयुक्त अरब अमीरात (चालू)", "સંયુક્ત આરબ અમીરાત (ચાલુ)"],
  ["More countries: not yet", "और देश: अभी नहीं", "વધુ દેશો: હજી નહીં"],
  ["Sample. Not a ruling on eligibility. Rates and rules change: confirm with DGFT, the export promotion council or your adviser.", "नमूना। पात्रता पर कोई फ़ैसला नहीं। दरें और नियम बदलते रहते हैं: DGFT, निर्यात संवर्धन परिषद या अपने सलाहकार से पुष्टि करें।", "નમૂનો. પાત્રતા પર કોઈ ચુકાદો નથી. દરો અને નિયમો બદલાતા રહે છે: DGFT, નિકાસ પ્રોત્સાહન પરિષદ કે તમારા સલાહકાર પાસે ખાતરી કરો."],
  ["To confirm", "पुष्टि करने के लिए", "ખાતરી કરવા માટે"],
  ["No source retrieved yet. Ask DGFT or an adviser.", "अभी कोई स्रोत नहीं मिला। DGFT या किसी सलाहकार से पूछें।", "હજી કોઈ સ્રોત મળ્યો નથી. DGFT કે કોઈ સલાહકારને પૂછો."],
  ["Run this on my own product", "इसे मेरे अपने उत्पाद पर चलाएँ", "આને મારા પોતાના ઉત્પાદન પર ચલાવો"],
  ["In the app, Atlas AI reads your own product and gives you this list for it.", "ऐप में, Atlas एआई आपका अपना उत्पाद पढ़ता है और उसके लिए यह सूची देता है।", "એપમાં, Atlas એઆઈ તમારું પોતાનું ઉત્પાદન વાંચીને તેના માટે આ યાદી આપે છે."],

  // Scheme demo data (src/lib/landing/scheme-demo.ts)
  ["India-UAE trade agreement (CEPA) origin", "भारत-UAE व्यापार समझौता (CEPA) मूल", "ભારત-UAE વેપાર કરાર (CEPA) મૂળ"],
  ["Read the product-specific origin rule for your 8-digit tariff line and check for amendments with the export promotion council or DGFT.", "अपनी 8-अंकीय टैरिफ़ लाइन का उत्पाद-विशेष मूल नियम पढ़ें और निर्यात संवर्धन परिषद या DGFT से संशोधन जाँचें।", "તમારી 8-અંકની ટેરિફ લાઇનનો ઉત્પાદન-વિશિષ્ટ મૂળ નિયમ વાંચો અને નિકાસ પ્રોત્સાહન પરિષદ કે DGFT પાસે સુધારા તપાસો."],
  ["RoDTEP", "RoDTEP", "RoDTEP"],
  ["Check the current DGFT notification for your product's tariff line before quoting any rate.", "कोई भी दर बताने से पहले अपने उत्पाद की टैरिफ़ लाइन के लिए DGFT की मौजूदा अधिसूचना जाँचें।", "કોઈ પણ દર જણાવતા પહેલાં તમારા ઉત્પાદનની ટેરિફ લાઇન માટે DGFT ની હાલની સૂચના તપાસો."],
  ["Duty drawback", "ड्यूटी ड्रॉबैक", "ડ્યુટી ડ્રોબેક"],
  ["Check the latest CBIC schedule, or ask your customs broker. Drawback and RoDTEP are generally not claimed for the same duty.", "CBIC की नवीनतम सूची जाँचें, या अपने कस्टम्स ब्रोकर से पूछें। ड्रॉबैक और RoDTEP आमतौर पर एक ही शुल्क के लिए नहीं माँगे जाते।", "CBIC ની નવીનતમ યાદી તપાસો, કે તમારા કસ્ટમ્સ બ્રોકરને પૂછો. ડ્રોબેક અને RoDTEP સામાન્ય રીતે એક જ ડ્યુટી માટે માંગવામાં આવતા નથી."],
  ["Ask DGFT or a trade consultant about current norms for your product and the export obligation period.", "अपने उत्पाद के मौजूदा मानकों और निर्यात दायित्व की अवधि के बारे में DGFT या किसी व्यापार सलाहकार से पूछें।", "તમારા ઉત્પાદન માટેના હાલના ધોરણો અને નિકાસ જવાબદારીના સમયગાળા વિશે DGFT કે કોઈ વેપાર સલાહકારને પૂછો."],
  ["State export incentives", "राज्य निर्यात प्रोत्साहन", "રાજ્ય નિકાસ પ્રોત્સાહનો"],
  ["Check your state industries department or district industries centre for current eligibility.", "मौजूदा पात्रता के लिए अपने राज्य के उद्योग विभाग या ज़िला उद्योग केंद्र से जाँच करें।", "હાલની પાત્રતા માટે તમારા રાજ્યના ઉદ્યોગ વિભાગ કે જિલ્લા ઉદ્યોગ કેન્દ્ર પાસે તપાસ કરો."],

  ["Containers and tableware are plastics articles, so the trade agreement could give preferential treatment if the origin rule is met.", "कंटेनर और टेबलवेयर प्लास्टिक के सामान हैं, इसलिए मूल नियम पूरा होने पर व्यापार समझौते से तरजीही व्यवहार मिल सकता है।", "કન્ટેનર અને ટેબલવેર પ્લાસ્ટિકની વસ્તુઓ છે, તેથી મૂળ નિયમ પૂરો થાય તો વેપાર કરારથી પસંદગીનો વ્યવહાર મળી શકે."],
  ["Embedded taxes on exported goods may be refunded for some tariff lines, and your headings may be among them.", "निर्यात किए माल में शामिल करों की वापसी कुछ टैरिफ़ लाइनों पर हो सकती है, और आपके हेडिंग उनमें हो सकते हैं।", "નિકાસ કરેલા માલમાં સમાયેલા કરોનું રિફંડ કેટલીક ટેરિફ લાઇન પર મળી શકે, અને તમારા હેડિંગ તેમાં હોઈ શકે."],
  ["Worth a look if you import resin or additives that carry customs duty.", "अगर आप रेज़िन या एडिटिव आयात करते हैं जिन पर सीमा शुल्क लगता है, तो देखने लायक है।", "જો તમે રેઝિન કે એડિટિવ આયાત કરો છો જેના પર કસ્ટમ્સ ડ્યુટી લાગે છે, તો જોવા લાયક છે."],
  ["Could suit a steady exporter that imports resin or masterbatch.", "रेज़िन या मास्टरबैच आयात करने वाले नियमित निर्यातक के लिए उपयुक्त हो सकता है।", "રેઝિન કે માસ્ટરબેચ આયાત કરતા નિયમિત નિકાસકાર માટે અનુકૂળ હોઈ શકે."],
  ["Your state may offer export support for manufacturers.", "आपका राज्य निर्माताओं को निर्यात सहायता दे सकता है।", "તમારું રાજ્ય ઉત્પાદકોને નિકાસ સહાય આપી શકે."],

  ["Household articles may qualify for preferential treatment, depending on the origin rule for the exact tariff line.", "सटीक टैरिफ़ लाइन के मूल नियम के आधार पर घरेलू सामान तरजीही व्यवहार के पात्र हो सकते हैं।", "ચોક્કસ ટેરિફ લાઇનના મૂળ નિયમ પ્રમાણે ઘરવપરાશની વસ્તુઓ પસંદગીના વ્યવહાર માટે પાત્ર હોઈ શકે."],
  ["Household and other plastic articles may sit under tariff lines that RoDTEP covers.", "घरेलू और अन्य प्लास्टिक सामान उन टैरिफ़ लाइनों में हो सकते हैं जिन्हें RoDTEP कवर करता है।", "ઘરવપરાશ અને અન્ય પ્લાસ્ટિકની વસ્તુઓ એવી ટેરિફ લાઇનમાં હોઈ શકે જેને RoDTEP આવરી લે છે."],
  ["Relevant if part of your material is imported with duty paid.", "प्रासंगिक है अगर आपकी सामग्री का कुछ हिस्सा शुल्क चुकाकर आयात होता है।", "સુસંગત છે જો તમારી સામગ્રીનો થોડો ભાગ ડ્યુટી ભરીને આયાત થાય છે."],
  ["Could suit regular volumes where most of your inputs are imported.", "नियमित मात्रा के लिए उपयुक्त हो सकता है जहाँ आपका ज़्यादातर कच्चा माल आयातित है।", "નિયમિત જથ્થા માટે અનુકૂળ હોઈ શકે જ્યાં તમારો મોટાભાગનો કાચો માલ આયાતી છે."],
  ["Your state may offer support for exporting units and clusters.", "आपका राज्य निर्यातक इकाइयों और क्लस्टरों को सहायता दे सकता है।", "તમારું રાજ્ય નિકાસ કરતા એકમો અને ક્લસ્ટરોને સહાય આપી શકે."],

  ["Pipes and tanks are plastics articles. Preference depends on meeting the origin rule for the tariff line.", "पाइप और टैंक प्लास्टिक के सामान हैं। तरजीही व्यवहार टैरिफ़ लाइन के मूल नियम को पूरा करने पर निर्भर है।", "પાઇપ અને ટાંકી પ્લાસ્ટિકની વસ્તુઓ છે. પસંદગીનો વ્યવહાર ટેરિફ લાઇનના મૂળ નિયમ પૂરા કરવા પર આધારિત છે."],
  ["Pipes and builders' ware may be under tariff lines that RoDTEP covers.", "पाइप और बिल्डर्स वेयर उन टैरिफ़ लाइनों में हो सकते हैं जिन्हें RoDTEP कवर करता है।", "પાઇપ અને બિલ્ડર્સ વેર એવી ટેરિફ લાઇનમાં હોઈ શકે જેને RoDTEP આવરી લે છે."],
  ["Worth a look if imported resin is a large part of your cost.", "देखने लायक है अगर आयातित रेज़िन आपकी लागत का बड़ा हिस्सा है।", "જોવા લાયક છે જો આયાતી રેઝિન તમારા ખર્ચનો મોટો ભાગ છે."],
  ["Could suit regular exports of extruded products made from imported resin.", "आयातित रेज़िन से बने एक्सट्रूडेड उत्पादों के नियमित निर्यात के लिए उपयुक्त हो सकता है।", "આયાતી રેઝિનમાંથી બનેલા એક્સ્ટ્રુડેડ ઉત્પાદનોની નિયમિત નિકાસ માટે અનુકૂળ હોઈ શકે."],
  ["Your state may offer incentives for export-oriented manufacturing.", "आपका राज्य निर्यात-उन्मुख विनिर्माण के लिए प्रोत्साहन दे सकता है।", "તમારું રાજ્ય નિકાસલક્ષી ઉત્પાદન માટે પ્રોત્સાહન આપી શકે."],

  ["Conduits and profiles are plastics articles. Preference depends on the origin rule for the exact heading.", "कंड्यूट और प्रोफ़ाइल प्लास्टिक के सामान हैं। तरजीही व्यवहार सटीक हेडिंग के मूल नियम पर निर्भर है।", "કન્ડ્યુટ અને પ્રોફાઇલ પ્લાસ્ટિકની વસ્તુઓ છે. પસંદગીનો વ્યવહાર ચોક્કસ હેડિંગના મૂળ નિયમ પર આધારિત છે."],
  ["Conduits, profiles and builders' ware may fall under tariff lines that RoDTEP covers.", "कंड्यूट, प्रोफ़ाइल और बिल्डर्स वेयर उन टैरिफ़ लाइनों में आ सकते हैं जिन्हें RoDTEP कवर करता है।", "કન્ડ્યુટ, પ્રોફાઇલ અને બિલ્ડર્સ વેર એવી ટેરિફ લાઇનમાં આવી શકે જેને RoDTEP આવરી લે છે."],
  ["Relevant if you import compounds or resin that carry customs duty.", "प्रासंगिक है अगर आप कंपाउंड या रेज़िन आयात करते हैं जिन पर सीमा शुल्क लगता है।", "સુસંગત છે જો તમે કમ્પાઉન્ડ કે રેઝિન આયાત કરો છો જેના પર કસ્ટમ્સ ડ્યુટી લાગે છે."],
  ["Could suit a steady exporter of extruded products with imported inputs.", "आयातित कच्चे माल वाले एक्सट्रूडेड उत्पादों के नियमित निर्यातक के लिए उपयुक्त हो सकता है।", "આયાતી કાચા માલવાળા એક્સ્ટ્રુડેડ ઉત્પાદનોના નિયમિત નિકાસકાર માટે અનુકૂળ હોઈ શકે."],
];

const hi: Dictionary = Object.fromEntries(ROWS.map(([en, h]) => [en, h]));
const gu: Dictionary = Object.fromEntries(ROWS.map(([en, , g]) => [en, g]));

export const site = { hi, gu };
