
// -- MODEL CONFIG : fallback chain ----------------------------------------
var GROQ_MODELS = [
  {id:'llama-3.3-70b-versatile', label:'LLaMA 3.3 70B', limit:100000},
  {id:'llama-3.1-8b-instant',    label:'LLaMA 3.1 8B',  limit:500000},
  {id:'gemma2-9b-it',            label:'Gemma2 9B',      limit:500000},
  {id:'mixtral-8x7b-32768',      label:'Mixtral 8x7B',   limit:500000}
];
var currentModelIdx = 0;
function getModel(){ return GROQ_MODELS[currentModelIdx].id; }
function nextModel(){
  if(currentModelIdx < GROQ_MODELS.length - 1){
    currentModelIdx++;
    showToast('Limite atteinte - bascule sur ' + GROQ_MODELS[currentModelIdx].label, 'success');
    return true;
  }
  return false;
}
async function groqFetch(ak, messages, maxTokens){
  maxTokens = maxTokens || 2800;
  for(var attempt = 0; attempt <= GROQ_MODELS.length; attempt++){
    try{
      var resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {'Content-Type':'application/json','Authorization':'Bearer '+ak},
        body: JSON.stringify({model:getModel(), temperature:0.1, max_tokens:maxTokens, messages:messages}),
        signal: AbortSignal.timeout(60000)
      });
      if(!resp.ok){
        var err = await resp.json();
        var msg = (err && err.error && err.error.message) || ('Erreur '+resp.status);
        if(resp.status===429 || msg.toLowerCase().indexOf('rate limit')!==-1 || msg.toLowerCase().indexOf('limit reached')!==-1 || msg.toLowerCase().indexOf('tpd')!==-1){
          if(nextModel()) continue;
        }
        throw new Error(msg);
      }
      var d = await resp.json();
      return (d && d.choices && d.choices[0] && d.choices[0].message && d.choices[0].message.content) || '';
    }catch(e){
      var msg2 = e.message || String(e);
      if(msg2.toLowerCase().indexOf('rate limit')!==-1 || msg2.toLowerCase().indexOf('limit reached')!==-1 || msg2.toLowerCase().indexOf('tpd')!==-1){
        if(nextModel()) continue;
      }
      throw e;
    }
  }
  throw new Error('Tous les modeles Groq sont en limite. Reessaie dans quelques minutes.');
}


// -- STATE -----------------------------------------------------------------
let selT = null, lastResult = null;
function load(k,d){try{return JSON.parse(localStorage.getItem(k))||d;}catch(e){return d;}}
function save(k,v){localStorage.setItem(k,JSON.stringify(v));}
let favs = load('ss_favs',[]);
let port = load('ss_port',[]);

// -- INIT ------------------------------------------------------------------
window.addEventListener('load', function(){
  // -- AUTO-MIGRATION: read all possible keys from previous versions --------
  var ALL_FAV_KEYS  = ['ss_favs','ss_favorites','stockscore_favs','stockscore_favorites','favs','favorites'];
  var ALL_PORT_KEYS = ['ss_port','ss_portfolio','stockscore_port','stockscore_portfolio','port','portfolio'];
  var ALL_KEY_KEYS  = ['groq_key','groq_key','gemini_api_key','ss_api_key'];

  function tryParseArr(val){ try{ var p=JSON.parse(val); return Array.isArray(p)?p:null; }catch(e){return null;} }

  // Collect favs from all known keys
  var allFavs = [];
  ALL_FAV_KEYS.forEach(function(k){
    var arr = tryParseArr(localStorage.getItem(k));
    if(arr && arr.length) allFavs = allFavs.concat(arr);
  });
  // Collect port from all known keys
  var allPort = [];
  ALL_PORT_KEYS.forEach(function(k){
    var arr = tryParseArr(localStorage.getItem(k));
    if(arr && arr.length) allPort = allPort.concat(arr);
  });

  // Deduplicate by company_name
  var seenF = {};
  allFavs = allFavs.filter(function(f){
    if(!f.company_name||seenF[f.company_name]) return false;
    seenF[f.company_name]=true; return true;
  });
  var seenP = {};
  allPort = allPort.filter(function(p){
    if(!p.company_name||seenP[p.company_name]) return false;
    seenP[p.company_name]=true; return true;
  });

  // Save under canonical keys if we found more data than what's already there
  if(allFavs.length > favs.length){ favs = allFavs; save('ss_favs', favs); }
  if(allPort.length > port.length){ port = allPort; save('ss_port', port); }

  // Show migration notice if data was found from old keys
  var oldFavKeys = ALL_FAV_KEYS.slice(1);
  var oldPortKeys = ALL_PORT_KEYS.slice(1);
  var migratedFavs = 0, migratedPort = 0;
  oldFavKeys.forEach(function(k){
    var arr=tryParseArr(localStorage.getItem(k));
    if(arr) migratedFavs+=arr.length;
  });
  oldPortKeys.forEach(function(k){
    var arr=tryParseArr(localStorage.getItem(k));
    if(arr) migratedPort+=arr.length;
  });
  if(migratedFavs>0||migratedPort>0){
    setTimeout(function(){
      showToast('Migration auto : '+favs.length+' favori(s) et '+port.length+' position(s) récupérés', 'success');
    }, 800);
  }

  // -- API KEY: check all known key names -----------------------------------
  var foundKey = null;
  ALL_KEY_KEYS.forEach(function(k){
    if(!foundKey){ var v=localStorage.getItem(k); if(v) foundKey=v; }
  });
  if(foundKey){
    // Ensure stored under canonical key
    localStorage.setItem('groq_key', foundKey);
    var inp = document.getElementById('apiKey');
    inp.value = foundKey.slice(0,6) + '************' + foundKey.slice(-4);
    var msg = document.getElementById('apiMsg');
    if(msg){ msg.textContent = 'Groq active'; msg.style.color = 'var(--green)'; msg.style.display = 'block'; }
  }
  var newsKey = localStorage.getItem('newsapi_key');
  if(newsKey){
    var ninp = document.getElementById('newsApiKey');
    if(ninp) ninp.value = newsKey.slice(0,4) + '************************' + newsKey.slice(-4);
    var nmsg = document.getElementById('newsApiMsg');
    if(nmsg){ nmsg.textContent = 'NewsAPI active'; nmsg.style.color = 'var(--amber)'; nmsg.style.display = 'block'; }
  }
  var tavilyKey = localStorage.getItem('tavily_key');
  if(tavilyKey){
    var tinp = document.getElementById('tavilyKey');
    if(tinp) tinp.value = tavilyKey.slice(0,5) + '************************' + tavilyKey.slice(-4);
    var tmsg = document.getElementById('tavilyMsg');
    if(tmsg){ tmsg.textContent = 'Tavily active'; tmsg.style.color = 'var(--teal)'; tmsg.style.display = 'block'; }
  }

  updateCounts(); updateDataSummary(); renderFavs(); renderPort(); initTop10();
});

function saveKey(){
  const k = document.getElementById('apiKey').value.trim();
  const msg = document.getElementById('apiMsg');
  if(!k){ msg.textContent='Entre ta cle Groq.'; msg.style.color='var(--red)'; msg.style.display='block'; return; }
  localStorage.setItem('groq_key', k);
  msg.textContent = 'Groq OK';
  msg.style.color = 'var(--green)';
  msg.style.display = 'block';
  document.getElementById('apiKey').value = k.slice(0,6) + '************' + k.slice(-4);
}

function saveNewsKey(){
  var inp = document.getElementById('newsApiKey');
  var msg = document.getElementById('newsApiMsg');
  if(!inp) return;
  var k = inp.value.trim();
  if(!k){ msg.textContent='Entre ta cle NewsAPI.'; msg.style.color='var(--red)'; msg.style.display='block'; return; }
  localStorage.setItem('newsapi_key', k);
  msg.textContent = 'NewsAPI OK';
  msg.style.color = 'var(--amber)';
  msg.style.display = 'block';
  inp.value = k.slice(0,4) + '************************' + k.slice(-4);
}

function saveTavilyKey(){
  var inp = document.getElementById('tavilyKey');
  var msg = document.getElementById('tavilyMsg');
  if(!inp) return;
  var k = inp.value.trim();
  if(!k){ msg.textContent='Entre ta cle Tavily.'; msg.style.color='var(--red)'; msg.style.display='block'; return; }
  localStorage.setItem('tavily_key', k);
  msg.textContent = 'Tavily OK — recherche web active';
  msg.style.color = 'var(--teal)';
  msg.style.display = 'block';
  inp.value = k.slice(0,5) + '************************' + k.slice(-4);
}

// -- TABS ------------------------------------------------------------------

// =============================================================================

function switchTab(t){
  ['analyze','favs','port','radar','guide','geo','screen'].forEach(id=>{
    var tab   = document.getElementById('tab-'+id);
    var panel = document.getElementById('panel-'+id);
    if(tab)   tab.classList.toggle('active',id===t);
    if(panel) panel.classList.toggle('active',id===t);
  });
  if(t==='radar') initRadar();
  if(t==='guide') initGuide();
  if(t==='geo')   initGeo();
  if(t==='screen') initScreen();
}
function updateCounts(){
  document.getElementById('fav-count').textContent=favs.length;
  document.getElementById('port-count').textContent=port.length;
}
function sT(t){
  selT=t;
  ['bio','large','sc'].forEach(function(id){var el=document.getElementById('t-'+id);if(el)el.classList.toggle('active',id===t);});
  var lbl=document.getElementById('type-required');
  if(lbl){lbl.textContent='Analyse :';lbl.style.color='var(--muted)';lbl.style.fontWeight='';}
}
function setSt(m){document.getElementById('stat').classList.add('on');document.getElementById('stxt').textContent=m;}
function hideSt(){document.getElementById('stat').classList.remove('on');}
function showE(m){const b=document.getElementById('err');b.innerHTML=m;b.classList.add('on');}
function hideE(){document.getElementById('err').classList.remove('on');}
function sc(s){return s>=5?'#3B6D11':s===4?'#639922':s===3?'#BA7517':s===2?'#f97316':'#A32D2D';}
function starsH(n,max,cls){let h='<div class="stars">';for(let i=1;i<=max;i++)h+=`<div class="star${i<=n?' on '+cls:''}"></div>`;return h+'</div>';}
function vc(v){return v==='INVESTISSABLE'?'inv':v==='SURVEILLER'?'surv':'evit';}
function vl(v){return v==='INVESTISSABLE'?'Investissable':v==='SURVEILLER'?'A surveiller':'À éviter';}

// -- LIVE PRICE via Yahoo Finance proxy ------------------------------------
async function fetchLiveData(ticker){
  if(!ticker||ticker==='-'||ticker==='') return null;
  var yhTicker = ticker.replace(/ .*/,'').trim().toUpperCase();

  // Helper to parse Yahoo chart response
  function parseChart(data){
    var res = data && data.chart && data.chart.result && data.chart.result[0];
    if(!res) return null;
    var meta = res.meta || {};
    var price = meta.regularMarketPrice || meta.currentPrice;
    if(!price) return null;
    var prev = meta.previousClose || meta.chartPreviousClose || price;
    var change = prev ? ((price-prev)/prev*100) : 0;
    return {
      price:      price,
      change:     change,
      divYield:   meta.dividendYield ? meta.dividendYield*100 : null,
      divRate:    meta.dividendRate   || null,
      currency:   meta.currency       || '',
      marketTime: meta.regularMarketTime
        ? new Date(meta.regularMarketTime*1000).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})
        : null
    };
  }

  // Helper to parse Yahoo quote response
  function parseQuote(data){
    var q = data && data.quoteResponse && data.quoteResponse.result && data.quoteResponse.result[0];
    if(!q) return null;
    var price = q.regularMarketPrice || q.currentPrice;
    if(!price) return null;
    var prev = q.regularMarketPreviousClose || q.previousClose || price;
    return {
      price:      price,
      change:     prev ? ((price-prev)/prev*100) : 0,
      divYield:   q.trailingAnnualDividendYield ? q.trailingAnnualDividendYield*100 : null,
      divRate:    q.trailingAnnualDividendRate   || null,
      currency:   q.currency || q.financialCurrency || '',
      marketTime: q.regularMarketTime
        ? new Date(q.regularMarketTime*1000).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})
        : null
    };
  }

  var proxies = [
    'https://api.allorigins.win/raw?url=',
    'https://api.allorigins.win/get?url=',
    'https://corsproxy.io/?',
    'https://api.codetabs.com/v1/proxy?quest='
  ];

  // Try 3 different Yahoo Finance endpoints
  var endpoints = [
    'https://query2.finance.yahoo.com/v8/finance/chart/'+encodeURIComponent(yhTicker)+'?interval=1d&range=5d',
    'https://query1.finance.yahoo.com/v8/finance/chart/'+encodeURIComponent(yhTicker)+'?interval=1d&range=5d',
    'https://query2.finance.yahoo.com/v7/finance/quote?symbols='+encodeURIComponent(yhTicker)
  ];

  for(var ei=0; ei<endpoints.length; ei++){
    for(var pi=0; pi<proxies.length; pi++){
      try{
        var resp = await fetch(proxies[pi]+encodeURIComponent(endpoints[ei]),{signal:AbortSignal.timeout(10000)});
        if(!resp.ok) continue;
        var txt = await resp.text();
        // allorigins /get wraps in JSON
        if(txt && txt.startsWith('{"contents"')){
          try{ var w=JSON.parse(txt); txt=w.contents||txt; }catch(e){}
        }
        if(!txt||txt.length<10) continue;
        var d = JSON.parse(txt);
        var result = ei<2 ? parseChart(d) : parseQuote(d);
        if(result && result.price) return result;
      }catch(e){}
    }
  }
  return null;
}

// -- ANALYZE ---------------------------------------------------------------
// -- ROBUST JSON PARSER ---------------------------------------------------
function parseGroqJSON(raw){
  if(!raw)throw new Error('Réponse vide du modèle');

  // Strategy 1: find first { and match balanced braces
  function extractBalanced(s){
    const start=s.indexOf('{');
    if(start===-1)return null;
    let depth=0,inStr=false,escape=false;
    for(let i=start;i<s.length;i++){
      const c=s[i];
      if(escape){escape=false;continue;}
      if(c==='\\'){escape=true;continue;}
      if(c==='"'&&!escape)inStr=!inStr;
      if(!inStr){
        if(c==='{')depth++;
        else if(c==='}'){depth--;if(depth===0)return s.slice(start,i+1);}
      }
    }
    return null;
  }

  // Strategy 2: clean common LLM JSON issues then parse
  function cleanAndParse(s){
    let c=s;
    // Remove markdown code fences
    c=c.replace(/```json\s*/gi,'').replace(/```\s*/g,'');
    // Fix trailing commas before } or ]
    c=c.replace(/,\s*([}\]])/g,'$1');
    // Fix single quotes used as string delimiters (simple cases)
    // Replace unescaped newlines inside strings
    c=c.replace(/([":,{\[]\s*)"([^"]*?)\n([^"]*?)"/g,(m,pre,a,b)=>pre+'"'+a+'\\n'+b+'"');
    return JSON.parse(c);
  }

  // Try strategy 1 + direct parse
  const balanced=extractBalanced(raw);
  if(balanced){
    try{return JSON.parse(balanced);}catch(e1){
      try{return cleanAndParse(balanced);}catch(e2){}
    }
  }

  // Try strategy 2: strip everything before first { and after last }
  const first=raw.indexOf('{');
  const last=raw.lastIndexOf('}');
  if(first!==-1&&last>first){
    const slice=raw.slice(first,last+1);
    try{return JSON.parse(slice);}catch(e){
      try{return cleanAndParse(slice);}catch(e2){}
    }
  }

  // Strategy 3: try the whole raw string
  try{return cleanAndParse(raw);}catch(e){}

  throw new Error('Impossible de parser la réponse JSON. Réessaie -- le modèle a généré une réponse malformée.');
}

// -- BUILD PROMPT ---------------------------------------------------------
function buildPrompt(co, typeHint, realtimeFacts, isBio, selT){

  var jsonSchema = '{"company_name":"","ticker":"TICKER - Marche","ticker_yahoo":"","sector":"","country":"","market_cap":"Xm EUR","type":"biotech ou smallcap","summary":"Resume analyse 3 phrases","dimensions":[{"name":"Nom dimension","score":3,"max":5,"note":"Explication score avec chiffres","is_eliminatoire":false}],"total_score":21,"max_score":35,"verdict":"INVESTISSABLE ou SURVEILLER ou EVITER","geopolitique_score":3,"geopolitique_note":"Explication","momentum_score":3,"momentum_note":"Explication","upside_12m":"+25%","upside_note":"Explication","timing":"ATTENDRE","timing_note":"Explication","news":[{"title":"Titre actualite reelle","detail":"Detail 1 phrase","impact":"pos ou neg ou neut"}],"dividend_annual":0,"dividend_yield":0,"dividend_note":"Explication dividende","sources":["Yahoo Finance","Reuters"],"strengths":["Point fort 1","Point fort 2"],"risks":["Risque 1","Risque 2"],"warnings":["Vigilance 1"],"roadmap":{"current_step":"phase2","completed_steps":["concept","preclin"],"analysis":"Description position actuelle"},"key_dates":[{"date":"JJ/MM/AAAA","title":"Evenement","detail":"Impact potentiel","type":"regulatory"}],"biotech_checklist":{"is_startup":"oui/non","is_startup_detail":"explication","revenus_recurrents":"oui/non/partiel","revenus_recurrents_detail":"chiffre CA recurrent","fda_obtenu":"oui/non/en_cours","fda_detail":"type approbation date numero","performance_clinique":"85%","performance_clinique_detail":"sensibilite specificite","dispositif_unique":"oui/non/partiel","dispositif_unique_detail":"positionnement","remboursement_etabli":"oui/non/en_cours","remboursement_detail":"statut HAS CMS","marquage_ce":"oui/non/en_cours","marquage_ce_detail":"statut CE date"},"smallcap_checklist":{"fcf_positif":"oui/non","fcf_detail":"montant FCF","dette_maitrisee":"oui/non","dette_detail":"ratio dette/EBITDA","dirigeant_actionnaire":"oui/non","dirigeant_detail":"% capital","revenus_recurrents":"oui/non/partiel","revenus_detail":"% CA recurrent","concentration_client":"ok/risque","concentration_detail":"% top client","dividende_croissant":"oui/non/absent","dividende_detail":"historique","profit_warning":"oui/non","profit_warning_detail":"date contexte"}}';

  // Build facts block from real-time JS data
  var factsBlock = '';
  if(realtimeFacts && realtimeFacts.length > 30){
    factsBlock = "\n\n" + realtimeFacts.slice(0, 4000) + "\n\n";
  }

  var biotechDims = "BIOTECH - 7 dimensions /5 chacune = /35 total:\n"
    + "1. Technologie&donnees: maturite tech, donnees cliniques, IP, innovation\n"
    + "2. Reglementaire FDA/CE: approbations (510k PMA CE Mark). Si obtenu -> 4-5 pts\n"
    + "3. Remboursement: prise en charge HAS/CMS, negociations assurances\n"
    + "4. Marche&competition: TAM, positionnement, barrieres entree\n"
    + "5. Equipe: experience dirigeants, track record, advisory board\n"
    + "6. Valorisation: EV/CA, comparables sectoriels, prime/decote\n"
    + "7. Tresorerie: cash runway (mois), burn rate, capacite financement\n";

  var largeDims = "LARGE CAP (>10Md$) - 8 dimensions /5 chacune = /40 total:\n"
    + "1. Business model: recurrence revenus, pricing power, moat defensif durable\n"
    + "2. Sante financiere: FCF (positif->4-5), dette/EBITDA (<1.5x->4-5), marges nettes\n"
    + "3. Croissance: CAGR CA 3 ans, expansion marges, retour capital actionnaires\n"
    + "4. Management: track record, alignement actionnaires, gouvernance\n"
    + "5. Moat: avantage concurrentiel durable (marque, brevets, effets reseau)\n"
    + "6. Valorisation: PER vs secteur, EV/EBITDA, FCF yield, prime justifiee\n"
    + "7. Liquidite: volume echanges, free float, acces marches capitaux\n"
    + "8. Risques: cyclicite, disruption, regulation, geopolitique\n";

  var scDims = "SMALL CAP (<2Md$) - 8 dimensions /5 chacune = /40 total:\n"
    + "1. Business model: recurrence revenus, pricing power, niche dominee\n"
    + "2. Sante financiere: FCF (positif->4-5), dette/EBITDA (<2x->4-5), marges\n"
    + "3. Croissance: CAGR CA 3 ans (>15%->5pts), visibilite backlog, internationalisation\n"
    + "4. Management: insiders (>5%->+1 pt), historique tenue objectifs, track record\n"
    + "5. Moat: avantage niche, switching costs, marque locale, brevets\n"
    + "6. Valorisation: PER vs secteur, EV/EBITDA, FCF yield attractif\n"
    + "7. Liquidite: volume echanges, flottant, acces capital\n"
    + "8. Risques: concentration client, cyclicite, disruption possible\n";

  var dims = isBio ? biotechDims : (selT==='large' ? largeDims : scDims);
  var maxScore = isBio ? 35 : 40;

  var checklistInstr = isBio
    ? "BIOTECH_CHECKLIST - renseigne tous les champs avec les donnees temps reel fournies:\n"
      + "- is_startup: oui si <5 ans ou pre-revenus, non si societe etablie avec CA\n"
      + "- revenus_recurrents: oui si >50% CA recurrent, partiel si mix, non si episodique\n"
      + "- fda_obtenu: si '510k' ou 'PMA' present dans les DONNEES TEMPS REEL -> oui obligatoirement. Copier device+date+numero dans fda_detail\n"
      + "- marquage_ce: si CE mentionne dans donnees temps reel ou tes connaissances -> statut exact\n"
      + "- performance_clinique: % efficacite des essais cliniques si disponible\n"
      + "- dispositif_unique: oui si pas de concurrent direct avec meme technologie\n"
      + "- remboursement_etabli: oui si remboursement confirme, en_cours si negociations\n"
      + "Mettre smallcap_checklist: null\n"
    : "SMALLCAP_CHECKLIST - renseigne avec les donnees financieres fournies:\n"
      + "- fcf_positif: si FCF dans donnees est >0 -> oui, sinon non\n"
      + "- dette_maitrisee: si Dette/FP <2 ou non mentionne -> oui par defaut\n"
      + "- dirigeant_actionnaire: si insiderPct >5% dans donnees -> oui\n"
      + "- revenus_recurrents: selon profil metier et donnees disponibles\n"
      + "- dividende_croissant: si DivYield present et >0 -> oui, sinon absent\n"
      + "- profit_warning: selon actualites fournies\n"
      + "Mettre biotech_checklist: null\n";

  return "Tu es un analyste financier expert. Nous sommes en mars 2026.\n\n"
    + "ENTREPRISE A ANALYSER: " + co + "\n"
    + (typeHint ? "TYPE INDIQUE: " + typeHint + "\n" : "")
    + "\n"
    + factsBlock
    + "MISSION: Analyser " + co + " en te basant PRIORITAIREMENT sur les donnees temps reel ci-dessus.\n"
    + "Les donnees ci-dessus sont reelles et datent d'aujourd'hui. Utilise-les pour chaque dimension et checklist.\n"
    + "Pour les infos non disponibles dans les donnees, utilise tes connaissances generales sur la societe.\n"
    + "NE MET JAMAIS 'Non disponible' comme note de dimension - analyse toujours avec ce que tu sais.\n\n"
    + dims + "\n"
    + "Notation: 5=Excellent, 4=Bon, 3=Moyen, 2=Faible, 1=Tres faible\n"
    + "La note de chaque dimension DOIT etre accompagnee d'une explication concrete de 1-2 phrases avec des chiffres si disponibles.\n\n"
    + checklistInstr + "\n"
    + "ACTUALITES: Utilise UNIQUEMENT les titres fournis dans les donnees temps reel. Si aucun titre fourni, mettre news=[]. ROADMAP: choisir current_step PRECIS base sur donnees reelles. Biotech: concept(recherche pure), preclin(tests labo), phase1(1ers essais humains), phase2(efficacite en cours), phase3(essai pivotal), approval(soumission/decision FDA ou CE), reimb(negociation remboursement HAS/CMS), market(produit commercialise CA genere). Large Cap (>10Md$): growth(croissance forte CAGR>8%), moat(avantage concurrentiel etabli), profit(FCF positif et marges stables), dividend(dividende verse et croissant), buyback(programme rachat actions), leader(position dominante marche mondial). Smallcap (<2Md$): startup(<3 ans), growth(CA >15%/an), profit(FCF positif stable), scale(expansion inter), mature(dividende etabli), leader(dominant niche). NE PAS mettre toutes etapes completees. KEY_DATES: 3-5 dates SPECIFIQUES prochains 18 mois (prochains resultats, readouts cliniques, decisions FDA/CE) avec format T2 2026 ou JJ/MM/AAAA et impact potentiel sur cours.\n"
    + "SOURCES: liste les sources reellement utilisees (Yahoo Finance, FDA.gov, ClinicalTrials.gov, NewsAPI, etc.)\n"
    + "IMPORTANT: Reponds UNIQUEMENT en JSON valide strict sans markdown, sans texte avant ni apres.\n"
    + "JSON schema a respecter exactement:\n"
    + jsonSchema;
}



// ===== REAL-TIME DATA ENGINE — Tavily + NewsAPI + Yahoo Finance ===========
// Architecture: Tavily pour actualités+réglementaire, Yahoo pour prix/fondamentaux

// ── TAVILY SEARCH — la pièce centrale, rapide et fiable ──────────────────
async function tavilySearch(query, maxResults){
  var key = localStorage.getItem('tavily_key');
  if(!key) return [];
  maxResults = maxResults || 5;
  try{
    var resp = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      signal: AbortSignal.timeout(8000),
      body: JSON.stringify({
        api_key: key,
        query: query,
        search_depth: 'basic',
        max_results: maxResults,
        include_answer: true,
        include_raw_content: false
      })
    });
    if(!resp.ok) return [];
    var d = await resp.json();
    return {
      answer: d.answer || '',
      results: (d.results || []).map(function(r){
        return {
          title:   r.title || '',
          url:     r.url   || '',
          content: (r.content || '').slice(0, 300),
          date:    r.published_date || ''
        };
      })
    };
  }catch(e){ return {answer:'', results:[]}; }
}

// ── NEWSAPI — actualités récentes ────────────────────────────────────────
async function fetchNewsAPI(company){
  var key = localStorage.getItem('newsapi_key');
  if(!key) return [];
  try{
    var url = 'https://newsapi.org/v2/everything?q='
      + encodeURIComponent('"' + company + '"')
      + '&language=fr&sortBy=publishedAt&pageSize=8&apiKey=' + key;
    var resp = await fetch(url, {signal: AbortSignal.timeout(10000)});
    if(!resp.ok) return [];
    var d = await resp.json();
    if(d.status !== 'ok') return [];
    var cutoff = Date.now() - 180*24*3600*1000;
    return (d.articles||[])
      .filter(function(a){ return new Date(a.publishedAt).getTime() > cutoff; })
      .slice(0,8)
      .map(function(a){
        return {
          title:  a.title || '',
          date:   new Date(a.publishedAt).toLocaleDateString('fr-FR'),
          ts:     new Date(a.publishedAt).getTime(),
          source: (a.source && a.source.name) || 'NewsAPI',
          url:    a.url || '',
          description: (a.description||'').slice(0,150)
        };
      });
  }catch(e){ return []; }
}

// ── YAHOO FINANCE — fondamentaux financiers ───────────────────────────────
async function findTicker(company){
  try{
    var url = 'https://query2.finance.yahoo.com/v1/finance/search?q='
      + encodeURIComponent(company) + '&quotesCount=6&newsCount=0&enableFuzzyQuery=true';
    var resp = await fetch(url, {signal: AbortSignal.timeout(5000)});
    if(!resp.ok) return '';
    var d = await resp.json();
    var eq = (d.quotes||[]).filter(function(q){ return q.quoteType==='EQUITY'; });
    if(!eq.length) return '';
    var fr = eq.find(function(q){ return q.symbol && q.symbol.endsWith('.PA'); });
    return (fr || eq[0]).symbol || '';
  }catch(e){ return ''; }
}

async function fetchFundamentals(ticker){
  if(!ticker) return {};
  try{
    var url = 'https://query2.finance.yahoo.com/v10/finance/quoteSummary/'
      + encodeURIComponent(ticker)
      + '?modules=financialData,defaultKeyStatistics,summaryDetail,assetProfile,earningsTrend';
    var resp = await fetch(url, {signal: AbortSignal.timeout(7000)});
    if(!resp.ok) return {};
    var d = await resp.json();
    var res = d && d.quoteSummary && d.quoteSummary.result && d.quoteSummary.result[0];
    if(!res) return {};
    var fin  = res.financialData        || {};
    var stat = res.defaultKeyStatistics || {};
    var summ = res.summaryDetail        || {};
    var prof = res.assetProfile         || {};
    var etrd = res.earningsTrend        || {};
    // earningsTrend: trend[0]=current year, trend[1]=next year
    var etCurrent  = (etrd.trend && etrd.trend[0]) || {};
    var etNext     = (etrd.trend && etrd.trend[1]) || {};
    var etGrowth   = (etCurrent.growth && etCurrent.growth.raw) ||
                     (etNext.growth    && etNext.growth.raw)    || null;
    // Also try earningsEstimate growth
    var etGrowthAlt = (etCurrent.earningsEstimate && etCurrent.earningsEstimate.growth && etCurrent.earningsEstimate.growth.raw) || null;
    if(!etGrowth && etGrowthAlt) etGrowth = etGrowthAlt;
    return {
      revenue:       fin.totalRevenue      && fin.totalRevenue.raw,
      revenueGrowth: fin.revenueGrowth     && fin.revenueGrowth.raw,
      grossMargin:   fin.grossMargins      && fin.grossMargins.raw,
      netMargin:     fin.profitMargins     && fin.profitMargins.raw,
      ebitda:        fin.ebitda            && fin.ebitda.raw,
      fcf:           fin.freeCashflow      && fin.freeCashflow.raw,
      totalCash:     fin.totalCash         && fin.totalCash.raw,
      totalDebt:     fin.totalDebt         && fin.totalDebt.raw,
      debtToEquity:  fin.debtToEquity      && fin.debtToEquity.raw,
      currentRatio:  fin.currentRatio      && fin.currentRatio.raw,
      roe:           fin.returnOnEquity    && fin.returnOnEquity.raw,
      evEbitda:      stat.enterpriseToEbitda && stat.enterpriseToEbitda.raw,
      priceToBook:   stat.priceToBook      && stat.priceToBook.raw,
      per:           stat.forwardPE        && stat.forwardPE.raw,
      perTrailing:   stat.trailingPE        && stat.trailingPE.raw,
      peg:            stat.pegRatio                    && stat.pegRatio.raw,
      earningsGrowth: fin.earningsGrowth               && fin.earningsGrowth.raw,
      earningsGrowthQ:stat.earningsQuarterlyGrowth     && stat.earningsQuarterlyGrowth.raw,
      epsGrowthFwd:   etGrowth || null,
      trailingEps:    stat.trailingEps  && stat.trailingEps.raw,
      forwardEps:     stat.forwardEps   && stat.forwardEps.raw,
      price:          fin.currentPrice  && fin.currentPrice.raw,
      insiderPct:    stat.heldPercentInsiders && stat.heldPercentInsiders.raw,
      beta:          stat.beta             && stat.beta.raw,
      marketCap:     summ.marketCap        && summ.marketCap.raw,
      divYield:      summ.dividendYield    && summ.dividendYield.raw,
      divRate:       summ.dividendRate     && summ.dividendRate.raw,
      sector:        prof.sector,
      industry:      prof.industry,
      employees:     prof.fullTimeEmployees,
      description:   prof.longBusinessSummary && prof.longBusinessSummary.slice(0, 400)
    };
  }catch(e){ return {}; }
}

// ── YAHOO NEWS — backup si pas de NewsAPI ─────────────────────────────────
async function fetchYahooNews(ticker, company){
  try{
    var q = ticker || company;
    var url = 'https://query2.finance.yahoo.com/v1/finance/search?q='
      + encodeURIComponent(q) + '&newsCount=8&quotesCount=0';
    var resp = await fetch(url, {signal: AbortSignal.timeout(5000)});
    if(!resp.ok) return [];
    var d = await resp.json();
    var cutoff = Date.now() - 180*24*3600*1000;
    return (d.news||[])
      .filter(function(n){ return (n.providerPublishTime||0)*1000 > cutoff; })
      .slice(0,6)
      .map(function(n){
        var ts = (n.providerPublishTime||0)*1000;
        return {
          title:  n.title||'',
          date:   ts ? new Date(ts).toLocaleDateString('fr-FR') : '',
          ts:     ts,
          source: n.publisher||'Yahoo Finance',
          url:    n.link||''
        };
      });
  }catch(e){ return []; }
}

// ── FDA 510k — base officielle (directe, sans proxy) ─────────────────────
async function fetchFDA510k(company){
  var parts = company.trim().split(/\s+/);
  var variants = [company, parts.slice(0,2).join(' '), parts[0]]
    .filter(function(v,i,a){ return v && v.length>=3 && a.indexOf(v)===i; });
  for(var i=0; i<variants.length; i++){
    try{
      var url = 'https://api.fda.gov/device/510k.json?search=applicant:"'
        + encodeURIComponent(variants[i]) + '"&sort=decision_date:desc&limit=5';
      var resp = await fetch(url, {signal: AbortSignal.timeout(7000)});
      if(!resp.ok) continue;
      var d = await resp.json();
      if(d && d.results && d.results.length){
        return d.results.map(function(r){
          return {type:'510k', device:r.device_name, applicant:r.applicant,
            decision:r.decision_description, date:r.decision_date, number:r.k_number};
        });
      }
    }catch(e){}
  }
  return [];
}

// ── CLINICALTRIALS — direct sans proxy ────────────────────────────────────
async function fetchTrials(company){
  try{
    var url = 'https://clinicaltrials.gov/api/v2/studies?query.spons='
      + encodeURIComponent(company) + '&sort=LastUpdatePostDate:desc&pageSize=4&format=json';
    var resp = await fetch(url, {signal: AbortSignal.timeout(7000)});
    if(!resp.ok) return [];
    var d = await resp.json();
    return (d.studies||[]).slice(0,4).map(function(s){
      var p  = s.protocolSection||{};
      var id = p.identificationModule||{};
      var st = p.statusModule||{};
      var ds = p.designModule||{};
      return {
        title:      id.briefTitle||'',
        status:     st.overallStatus||'',
        phase:      (ds.phases||[]).join('/'),
        lastUpdate: (st.lastUpdatePostDateStruct&&st.lastUpdatePostDateStruct.date)||''
      };
    });
  }catch(e){ return []; }
}

// ── MASTER COLLECT — tout en parallèle ───────────────────────────────────
async function collectAllData(company, isBio){
  var hasTavily  = !!localStorage.getItem('tavily_key');
  var hasNewsAPI = !!localStorage.getItem('newsapi_key');

  setSt('Recherche du ticker...');
  var ticker = await findTicker(company);

  setSt('Collecte des donnees en parallele...');

  // Build query for Tavily
  var tavilyQuery = isBio
    ? company + ' FDA CE approval clinical trial results 2025 2026 revenue reimbursement'
    : company + ' financial results revenue profit dividend 2025 2026 management';

  var promises = [
    fetchFundamentals(ticker),
    hasNewsAPI ? fetchNewsAPI(company) : fetchYahooNews(ticker, company),
    hasTavily  ? tavilySearch(tavilyQuery, 6) : Promise.resolve({answer:'',results:[]}),
    isBio ? fetchFDA510k(company)  : Promise.resolve([]),
    isBio ? fetchTrials(company)   : Promise.resolve([])
  ];

  var settled = await Promise.allSettled(promises);
  var get = function(i){ 
    if(settled[i].status !== 'fulfilled') return null;
    return settled[i].value;
  };

  // Merge news: NewsAPI/Yahoo + Tavily results
  var allNews = [];
  var seenTitles = {};
  var newsArr = get(1) || [];
  newsArr.forEach(function(n){
    var key = (n.title||'').slice(0,40).toLowerCase();
    if(!seenTitles[key] && n.title){ seenTitles[key]=true; allNews.push(n); }
  });
  // Add Tavily results as news items
  var tavilyData = get(2) || {answer:'',results:[]};
  (tavilyData.results||[]).forEach(function(r){
    var key = (r.title||'').slice(0,40).toLowerCase();
    if(!seenTitles[key] && r.title){
      seenTitles[key]=true;
      allNews.push({title:r.title, date:r.date||'', ts:0, source:'Tavily/Web', url:r.url, description:r.content});
    }
  });
  allNews.sort(function(a,b){ return (b.ts||0)-(a.ts||0); });

  return {
    ticker:       ticker,
    fundamentals: get(0) || {},
    news:         allNews.slice(0,10),
    tavilyAnswer: tavilyData.answer || '',
    tavilySources: (tavilyData.results||[]).map(function(r){return r.url;}).slice(0,3),
    fda510k:      isBio ? (get(3)||[]) : [],
    trials:       isBio ? (get(4)||[]) : []
  };
}

// ── FORMAT PROMPT ─────────────────────────────────────────────────────────
function dataToPromptText(data, company, isBio){
  var f    = data.fundamentals || {};
  var date = new Date().toLocaleDateString('fr-FR');
  var lines = [
    '=== DONNEES TEMPS REEL — ' + date + ' ===',
    'Societe: ' + company,
    'Ticker: ' + (data.ticker || 'non trouve')
  ];

  // Tavily answer (synthese web temps reel)
  if(data.tavilyAnswer && data.tavilyAnswer.length > 20){
    lines.push('');
    lines.push('--- SYNTHESE WEB TEMPS REEL (Tavily — ' + date + ') ---');
    lines.push(data.tavilyAnswer.slice(0, 800));
  }

  // Financials
  var hasF = Object.keys(f).some(function(k){ return f[k] != null; });
  if(hasF){
    lines.push('');
    lines.push('--- FINANCIER Yahoo Finance ---');
    var fmtM   = function(v){ return v!=null ? Math.round(v/1e6)+'M EUR' : null; };
    var fmtPct = function(v){ return v!=null ? Math.round(v*100)+'%' : null; };
    [
      ['CA',           fmtM(f.revenue)],
      ['Croissance CA',fmtPct(f.revenueGrowth)],
      ['Marge brute',  fmtPct(f.grossMargin)],
      ['Marge nette',  fmtPct(f.netMargin)],
      ['EBITDA',       fmtM(f.ebitda)],
      ['FCF',          f.fcf!=null ? fmtM(f.fcf)+(f.fcf>0?' POSITIF':' NEGATIF') : null],
      ['Cash',         fmtM(f.totalCash)],
      ['Dette',        fmtM(f.totalDebt)],
      ['Dette/FP',     f.debtToEquity!=null ? f.debtToEquity.toFixed(1) : null],
      ['Current ratio',f.currentRatio!=null ? f.currentRatio.toFixed(2) : null],
      ['ROE',          fmtPct(f.roe)],
      ['EV/EBITDA',    f.evEbitda!=null ? f.evEbitda.toFixed(1)+'x' : null],
      ['P/B',          f.priceToBook!=null ? f.priceToBook.toFixed(2)+'x' : null],
      ['PER fwd',      f.per!=null ? f.per.toFixed(1)+'x' : null],
      ['PEG ratio',    f.peg!=null ? f.peg.toFixed(2)+(f.peg<1?' — sous-eval croissance':f.peg<2?' — raisonnable':' — cher vs croissance') : null],
      ['Insiders',     fmtPct(f.insiderPct)],
      ['Dividende',    f.divRate>0 ? f.divRate+' EUR ('+fmtPct(f.divYield)+')' : 'Aucun'],
      ['Secteur',      f.sector ? f.sector+(f.industry?'/'+f.industry:'') : null],
      ['Employes',     f.employees ? f.employees.toLocaleString() : null]
    ].forEach(function(r){ if(r[1]!=null) lines.push(r[0]+': '+r[1]); });
    if(f.description) lines.push('Description: '+f.description.slice(0,300));
  }

  // FDA
  if(isBio){
    lines.push('');
    if(data.fda510k && data.fda510k.length){
      lines.push('--- FDA 510k (FDA.gov officiel) ---');
      data.fda510k.forEach(function(r){
        lines.push('APPROUVE: '+r.device+' | '+r.decision+' | '+r.date+' | ref:'+r.number);
      });
      lines.push('INSTRUCTION: fda_obtenu=oui obligatoirement, copier details ci-dessus dans fda_detail');
    } else {
      lines.push('--- FDA: aucune approbation 510k trouvee sous ce nom ---');
    }
    lines.push('');
    if(data.trials && data.trials.length){
      lines.push('--- ClinicalTrials.gov ---');
      data.trials.forEach(function(t){
        lines.push(t.title+' | Phase:'+t.phase+' | Statut:'+t.status+' | MAJ:'+t.lastUpdate);
      });
    }
  }

  // News
  lines.push('');
  if(data.news && data.news.length){
    lines.push('--- ACTUALITES RECENTES (utiliser UNIQUEMENT ces titres dans le champ news) ---');
    data.news.forEach(function(n){
      lines.push('['+( n.date||'?')+'] '+n.title+(n.description?' — '+n.description:'')+' ('+n.source+')');
    });
  } else {
    lines.push('--- ACTUALITES: aucune trouvee — mettre news=[] dans le JSON ---');
  }

  lines.push('');
  lines.push('=== FIN DONNEES ===');
  return lines.join('\n');
}

// ── WRAPPERS ──────────────────────────────────────────────────────────────
async function fetchBiotechFacts(company){
  var data = await collectAllData(company, true);
  window._rtData = data;
  return dataToPromptText(data, company, true);
}
async function fetchScFacts(company){
  var data = await collectAllData(company, false);
  window._rtData = data;
  return dataToPromptText(data, company, false);
}
// =============================================================================


async function go(overrideName, onDone){
  const ak=localStorage.getItem('groq_key')||'';
  if(!ak){showE('Entre ta cle API Groq et clique Enregistrer.');return;}
  const co=overrideName||document.getElementById('cInput').value.trim();
  if(!co)return;
  if(!selT){
    showE("Choisis d'abord un type d'analyse : 🧬 Biotech, 🏢 Large Cap ou 📈 Small Cap");
    ['t-bio','t-large','t-sc'].forEach(function(id){
      var el=document.getElementById(id);
      if(el){el.style.outline='2px solid var(--red)';setTimeout(function(){el.style.outline='';},2000);}
    });
    return;
  }
  const btn=document.getElementById('gbtn');
  btn.disabled=true; hideE();
  document.getElementById('res').classList.remove('on');
  const isBio = selT==='bio';
  const th = isBio ? "C'est une biotech/medtech. Analyse pipeline FDA/CE, runway, rNPV."
           : selT==='large' ? "C'est une grande capitalisation >10Md$. Analyse moat, FCF, valorisation."
           : "C'est une small cap <2Md$. Analyse croissance, catalyseurs, insider buying.";

  var realtimeFacts = '';
  if(isBio){
    setSt('Recherche des donnees reglementaires en temps reel...');
    realtimeFacts = await fetchBiotechFacts(co);
  } else {
    setSt('Recherche des donnees financieres en temps reel...');
    realtimeFacts = await fetchScFacts(co);
  }

  const prompt=buildPrompt(co, th, realtimeFacts, isBio, selT);

  try{
    setSt('Analyse IA Groq en cours...');
    const raw=await groqFetch(ak,[
      {role:'system',content:'Tu es un analyste financier expert. Tu reponds UNIQUEMENT en JSON valide strict, sans aucun texte avant ou apres, sans balises markdown. Toutes les valeurs string sur une seule ligne. Ne mets jamais Non disponible comme note de dimension.'},
      {role:'user',content:prompt}
    ], 2800);
    lastResult={...parseGroqJSON(raw),analyzed_at:new Date().toLocaleDateString('fr-FR')};
    renderAnalysis(lastResult);
    if(typeof onDone==='function') onDone(lastResult);
  }catch(e){
    showE('<strong>Erreur :</strong> '+e.message+'<br><small>Verifie ta cle Groq et ta connexion.</small>');
    if(typeof onDone==='function') onDone(null);
  }finally{btn.disabled=false;hideSt();}
}


var priceChartInstance = null;
async function fetchPriceHistory(ticker){
  if(!ticker) return null;
  var yhTicker = ticker.replace(/ .*/,'').trim().toUpperCase();

  // ── Strategy 1: Direct Yahoo Finance (works in browser, no CORS issue) ─
  var yhUrls = [
    'https://query1.finance.yahoo.com/v8/finance/chart/'+encodeURIComponent(yhTicker)+'?interval=1wk&range=1y&includePrePost=false',
    'https://query2.finance.yahoo.com/v8/finance/chart/'+encodeURIComponent(yhTicker)+'?interval=1wk&range=1y&includePrePost=false',
    'https://query1.finance.yahoo.com/v8/finance/chart/'+encodeURIComponent(yhTicker)+'?interval=1mo&range=2y&includePrePost=false'
  ];
  for(var ui=0; ui<yhUrls.length; ui++){
    try{
      var resp = await fetch(yhUrls[ui],{
        signal: AbortSignal.timeout(10000),
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      if(!resp.ok) continue;
      var d = await resp.json();
      var parsed = parseYahooChart(d);
      if(parsed) return parsed;
    }catch(e){}
  }

  // ── Strategy 2: Via proxies ────────────────────────────────────────────
  var proxies = [
    'https://api.allorigins.win/raw?url=',
    'https://api.allorigins.win/get?url=',
    'https://corsproxy.io/?',
    'https://api.codetabs.com/v1/proxy?quest='
  ];
  var url = 'https://query1.finance.yahoo.com/v8/finance/chart/'+encodeURIComponent(yhTicker)+'?interval=1wk&range=1y';
  for(var pi=0; pi<proxies.length; pi++){
    try{
      var resp2 = await fetch(proxies[pi]+encodeURIComponent(url),{signal:AbortSignal.timeout(8000)});
      if(!resp2.ok) continue;
      var txt = await resp2.text();
      if(txt && txt.startsWith('{"contents"')){try{var w=JSON.parse(txt);txt=w.contents||txt;}catch(e){}}
      if(!txt||txt.length<20) continue;
      var d2 = JSON.parse(txt);
      var parsed2 = parseYahooChart(d2);
      if(parsed2) return parsed2;
    }catch(e){}
  }

  // ── Strategy 3: Stooq CSV (no auth, CORS-friendly for many tickers) ───
  try{
    var stooqTicker = yhTicker.replace('.PA','.FR').replace('.AS','.NL')
      .replace('.DE','.DE').replace('.MI','.IT').replace('.MC','.ES')
      .toLowerCase();
    var stooqUrl = 'https://stooq.com/q/d/l/?s='+stooqTicker+'&i=w';
    var sr = await fetch('https://api.allorigins.win/raw?url='+encodeURIComponent(stooqUrl),
      {signal:AbortSignal.timeout(8000)});
    if(sr.ok){
      var csv = await sr.text();
      if(csv && csv.includes('Date') && csv.includes(',') && csv.length > 100){
        var parsed3 = parseStooqCSV(csv);
        if(parsed3 && parsed3.points.length > 4) return parsed3;
      }
    }
  }catch(e){}

  return null;
}

function parseYahooChart(d){
  var res = d && d.chart && d.chart.result && d.chart.result[0];
  if(!res) return null;
  var timestamps = res.timestamp||[];
  var closes = (res.indicators&&res.indicators.quote&&res.indicators.quote[0]&&res.indicators.quote[0].close)||[];
  if(!timestamps.length||!closes.length) return null;
  var points = [];
  for(var i=0;i<timestamps.length;i++){
    if(closes[i]!=null) points.push({x:new Date(timestamps[i]*1000).toISOString().slice(0,10),y:parseFloat(closes[i].toFixed(3))});
  }
  if(points.length < 4) return null;
  return {points:points, currency:res.meta&&res.meta.currency||''};
}

function parseStooqCSV(csv){
  var lines = csv.trim().split('\n');
  if(lines.length < 5) return null;
  var points = [];
  // Header: Date,Open,High,Low,Close,Volume
  for(var i=lines.length-1; i>=1; i--){
    var cols = lines[i].split(',');
    if(cols.length < 5) continue;
    var dateStr = cols[0].trim(); // YYYY-MM-DD
    var close   = parseFloat(cols[4]);
    if(!dateStr||isNaN(close)||close<=0) continue;
    points.push({x:dateStr, y:parseFloat(close.toFixed(3))});
  }
  points.sort(function(a,b){ return a.x < b.x ? -1 : 1; });
  // Keep last 52 weeks
  var cutoff = new Date(Date.now() - 365*24*3600*1000).toISOString().slice(0,10);
  points = points.filter(function(p){ return p.x >= cutoff; });
  return points.length >= 4 ? {points:points, currency:''} : null;
}

// ── Technical Indicators: RSI30 + MM200 ──────────────────────────────────
function calcRSI(closes, period){
  // period = 30 for RSI30
  if(!closes || closes.length < period + 1) return null;
  var gains = [], losses = [];
  for(var i = 1; i < closes.length; i++){
    var diff = closes[i] - closes[i-1];
    gains.push(diff > 0 ? diff : 0);
    losses.push(diff < 0 ? -diff : 0);
  }
  // Initial average
  var avgGain = gains.slice(0, period).reduce(function(a,b){return a+b;},0) / period;
  var avgLoss = losses.slice(0, period).reduce(function(a,b){return a+b;},0) / period;
  // Wilder smoothing
  for(var i = period; i < gains.length; i++){
    avgGain = (avgGain * (period - 1) + gains[i]) / period;
    avgLoss = (avgLoss * (period - 1) + losses[i]) / period;
  }
  if(avgLoss === 0) return 100;
  var rs = avgGain / avgLoss;
  return Math.round(100 - (100 / (1 + rs)));
}

function calcMA(closes, period){
  if(!closes || closes.length < period) return null;
  var slice = closes.slice(closes.length - period);
  return slice.reduce(function(a,b){return a+b;},0) / period;
}

function addIndicatorsToChart(prices){
  // prices = [{x:'YYYY-MM-DD', y: price}, ...]
  var closes = prices.map(function(p){ return p.y; });
  var rsi30   = calcRSI(closes, 30);
  var mm200   = closes.length >= 200 ? calcMA(closes, 200) : null;
  var mm50    = closes.length >= 50  ? calcMA(closes, 50)  : null;
  var mm20    = closes.length >= 20  ? calcMA(closes, 20)  : null;
  var lastPrice = closes[closes.length - 1];

  return {
    rsi30:    rsi30,
    mm200:    mm200 ? parseFloat(mm200.toFixed(3)) : null,
    mm50:     mm50  ? parseFloat(mm50.toFixed(3))  : null,
    mm20:     mm20  ? parseFloat(mm20.toFixed(3))  : null,
    lastPrice: lastPrice,
    aboveMM200: mm200 ? lastPrice > mm200 : null,
    aboveMM50:  mm50  ? lastPrice > mm50  : null,
    rsiZone:  rsi30 ? (rsi30 >= 70 ? 'surachat' : rsi30 <= 30 ? 'survente' : 'neutre') : null
  };
}

async function renderPriceChart(r){
  var loading=document.getElementById("price-chart-loading");
  var canvas=document.getElementById("price-chart");
  var emptyEl=document.getElementById("price-chart-empty");
  var section=document.getElementById("price-chart-section");
  if(!loading||!canvas||!emptyEl) return;
  loading.style.display="block"; canvas.style.display="none"; emptyEl.style.display="none";

  var ticker = (window._rtData && window._rtData.ticker)
    || r.ticker_yahoo
    || (r.ticker && r.ticker.split(' ')[0]);
  if(ticker) ticker = ticker.replace(/\s.*/,'').trim().toUpperCase();
  if(!ticker){
    loading.style.display="none"; emptyEl.style.display="block";
    emptyEl.textContent="Ticker introuvable."; return;
  }

  var hist = await fetchPriceHistory(ticker);
  loading.style.display="none";
  if(!hist||!hist.points||hist.points.length<4){
    emptyEl.style.display="block";
    emptyEl.innerHTML='Historique non disponible pour <strong>'+ticker+'</strong>'
      +' — <a href="https://finance.yahoo.com/quote/'+ticker+'" target="_blank" style="color:var(--info)">Vérifier sur Yahoo Finance</a>';
    return;
  }

  if(priceChartInstance){priceChartInstance.destroy();priceChartInstance=null;}

  var prices = hist.points;
  var annotations = {};
  var moveEvents = [];  // key moves for the legend below chart

  // ── Detect significant weekly moves ≥ 8% ────────────────────────────
  for(var i=1;i<prices.length;i++){
    var prev=prices[i-1].y, curr=prices[i].y;
    if(!prev||!curr||prev<=0) continue;
    var chg=(curr-prev)/prev*100;
    if(Math.abs(chg)>=8){
      var isPos = chg>0;
      var col = isPos ? "#3B6D11" : "#A32D2D";
      var key = "move"+i;
      annotations[key] = {
        type:"line", xMin:prices[i].x, xMax:prices[i].x,
        borderColor:col, borderWidth:2, borderDash:[5,3],
        label:{
          display:true,
          content:(isPos?"+":"")+chg.toFixed(1)+"%",
          position:"start",
          yAdjust:-8,
          backgroundColor:col,
          color:"#fff",
          font:{size:10,weight:"bold"},
          padding:{x:5,y:3},
          borderRadius:4
        }
      };
      moveEvents.push({date:prices[i].x, chg:chg, price:curr, col:col});
    }
  }

  // ── Chart render ─────────────────────────────────────────────────────
  var isDark = window.matchMedia("(prefers-color-scheme:dark)").matches;
  var gc = isDark?"rgba(255,255,255,0.07)":"rgba(0,0,0,0.05)";
  var lc = isDark?"#9c9a92":"#6b6b68";

  canvas.style.display="block";
  // Register annotation plugin
  if(window.ChartAnnotation){
    Chart.register(window.ChartAnnotation);
  }

  // Calculate indicators
  var indicators = addIndicatorsToChart(prices);
  var datasets = [{
    data:prices,
    borderColor:"#185FA5",
    borderWidth:2,
    pointRadius:0,
    pointHoverRadius:5,
    fill:true,
    backgroundColor:isDark?"rgba(24,95,165,0.10)":"rgba(24,95,165,0.07)",
    tension:0.3,
    label:'Prix'
  }];
  // Add MM200 line if enough data
  if(indicators.mm200 && prices.length >= 200){
    var mm200Data = [];
    for(var mi = prices.length - 1; mi >= 0; mi--){
      var sliceEnd = mi + 1;
      if(sliceEnd < 200) break;
      var s = prices.slice(sliceEnd-200, sliceEnd).map(function(p){return p.y;});
      var avg = s.reduce(function(a,b){return a+b;},0)/200;
      mm200Data.unshift({x: prices[mi].x, y: parseFloat(avg.toFixed(3))});
    }
    datasets.push({
      data: mm200Data,
      borderColor: "#854F0B",
      borderWidth: 1.5,
      borderDash: [6,3],
      pointRadius: 0,
      fill: false,
      tension: 0.2,
      label: 'MM200'
    });
  }
  // Add MM50 line
  if(indicators.mm50 && prices.length >= 50){
    var mm50Data = [];
    for(var mi2 = prices.length - 1; mi2 >= 0; mi2--){
      var sliceEnd2 = mi2 + 1;
      if(sliceEnd2 < 50) break;
      var s2 = prices.slice(sliceEnd2-50, sliceEnd2).map(function(p){return p.y;});
      var avg2 = s2.reduce(function(a,b){return a+b;},0)/50;
      mm50Data.unshift({x: prices[mi2].x, y: parseFloat(avg2.toFixed(3))});
    }
    datasets.push({
      data: mm50Data,
      borderColor: "#3B6D11",
      borderWidth: 1.5,
      borderDash: [3,2],
      pointRadius: 0,
      fill: false,
      tension: 0.2,
      label: 'MM50'
    });
  }

  priceChartInstance = new Chart(canvas,{
    type:"line",
    data:{datasets: datasets},
    options:{
      responsive:true,
      maintainAspectRatio:true,
      aspectRatio: window.innerWidth < 600 ? 1.8 : 2.8,
      interaction:{mode:"index",intersect:false},
      plugins:{
        legend:{display:false},
        tooltip:{
          backgroundColor: isDark?"rgba(30,30,30,0.95)":"rgba(255,255,255,0.97)",
          borderColor: isDark?"#444":"#e4e2dc",
          borderWidth:1,
          titleColor: isDark?"#e2e0d8":"#1a1a18",
          bodyColor: isDark?"#9c9a92":"#6b6b68",
          callbacks:{
            title:function(items){ return items[0]?new Date(items[0].parsed.x).toLocaleDateString('fr-FR',{month:'short',year:'numeric'}):'' },
            label:function(ctx){ return '  '+ctx.parsed.y.toFixed(2)+' '+(hist.currency||''); }
          }
        },
        annotation:{annotations:annotations}
      },
      scales:{
        x:{
          type:"time",
          time:{unit:"month",displayFormats:{month:"MMM yy"}},
          grid:{color:gc},
          ticks:{color:lc,font:{size:10},maxRotation:0}
        },
        y:{
          position:"right",
          grid:{color:gc},
          ticks:{color:lc,font:{size:10},callback:function(v){return v.toFixed(2);}}
        }
      }
    }
  });

  // ── Render event legend below chart ──────────────────────────────────
  // Remove existing legend
  var oldLegend = document.getElementById('chart-event-legend');
  if(oldLegend) oldLegend.remove();

  // ── RSI30 + MM indicator bar ─────────────────────────────────────────
  var oldBar = document.getElementById('chart-indicator-bar');
  if(oldBar) oldBar.remove();
  if(indicators.rsi30 !== null){
    var barDiv = document.createElement('div');
    barDiv.id = 'chart-indicator-bar';
    barDiv.style.cssText = 'display:flex;align-items:center;gap:10px;padding:8px 14px 4px;flex-wrap:wrap;border-top:1px solid var(--border);';
    var rsi = indicators.rsi30;
    var rsiCol = rsi >= 70 ? '#A32D2D' : rsi <= 30 ? '#0F6E56' : '#854F0B';
    var rsiLabel = rsi >= 70 ? 'Surachat' : rsi <= 30 ? 'Survente — opportunite' : 'Neutre';
    var mm200txt = indicators.mm200
      ? (indicators.aboveMM200 ? '<span style="color:#3B6D11">&#x2191; Au-dessus MM200</span>' : '<span style="color:#A32D2D">&#x2193; Sous MM200</span>')
        + ' (' + indicators.mm200.toFixed(2) + ')'
      : '<span style="color:var(--muted)">MM200 : données insuffisantes (&lt;200 semaines)</span>';
    var mm50txt = indicators.mm50
      ? (indicators.aboveMM50 ? '<span style="color:#3B6D11">&#x2191; Au-dessus MM50</span>' : '<span style="color:#A32D2D">&#x2193; Sous MM50</span>')
        + ' (' + indicators.mm50.toFixed(2) + ')'
      : '';
    barDiv.innerHTML =
      '<span style="font-size:11px;font-weight:700;color:'+rsiCol+';background:rgba(0,0,0,0.05);padding:3px 9px;border-radius:6px;border:1px solid '+rsiCol+'40;">'
      +'RSI30 : '+rsi+' — '+rsiLabel+'</span>'
      +'<span style="font-size:11px;color:var(--muted);">|</span>'
      +'<span style="font-size:11px;">'+mm200txt+'</span>'
      +(mm50txt?'<span style="font-size:11px;color:var(--muted);">|</span>'
        +'<span style="font-size:11px;">'+mm50txt+'</span>':'')
      +'<span style="font-size:10px;color:var(--muted);margin-left:auto;">'
      +'<span style="display:inline-block;width:14px;height:2px;background:#854F0B;margin-right:3px;vertical-align:middle;"></span>MM200 '
      +'<span style="display:inline-block;width:14px;height:2px;background:#3B6D11;margin-right:3px;vertical-align:middle;margin-left:8px;"></span>MM50'
      +'</span>';
    section.appendChild(barDiv);
  }

  if(moveEvents.length > 0){
    var legendDiv = document.createElement('div');
    legendDiv.id = 'chart-event-legend';
    legendDiv.style.cssText = 'padding:10px 14px 4px;';

    // Ask IA to explain the top moves (use context from analysis)
    var legendHtml = '<div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);margin-bottom:8px;">Mouvements significatifs (&ge;8%)</div>';
    legendHtml += '<div style="display:flex;flex-direction:column;gap:6px;">';

    // Match moves to news if dates are close
    var newsArr = r.news || [];

    moveEvents.slice(0,6).forEach(function(mv){
      var mvDate = new Date(mv.date);
      var isPos = mv.chg > 0;
      var col = mv.col;

      // Try to find a matching news item (within 14 days)
      var matchedNews = null;
      newsArr.forEach(function(n){
        if(!n.date || !n.date.match(/\d{2}\/\d{2}\/\d{4}/)) return;
        var p = n.date.split('/');
        var nd = new Date(p[2]+'-'+p[1]+'-'+p[0]);
        var diff = Math.abs(mvDate - nd) / (1000*3600*24);
        if(diff <= 14 && (!matchedNews || diff < Math.abs(mvDate - (function(){var p2=matchedNews.date.split('/');return new Date(p2[2]+'-'+p2[1]+'-'+p2[0]);})()))){
          matchedNews = n;
        }
      });

      var dateLabel = mvDate.toLocaleDateString('fr-FR',{month:'short',year:'numeric'});
      var pctLabel = (isPos?'+':'')+mv.chg.toFixed(1)+'%';
      var explanation = matchedNews
        ? matchedNews.title
        : (isPos ? 'Catalyseur positif — voir actualités' : 'Pression vendeuse — voir actualités');

      legendHtml += '<div style="display:flex;align-items:flex-start;gap:8px;">'
        +'<span style="background:'+col+';color:#fff;font-size:10px;font-weight:700;padding:1px 6px;border-radius:4px;white-space:nowrap;flex-shrink:0;margin-top:1px;">'+pctLabel+'</span>'
        +'<span style="font-size:11px;color:var(--muted);flex:1;"><strong style="color:var(--text);">'+dateLabel+'</strong> — '+explanation+'</span>'
        +'</div>';
    });

    legendHtml += '</div>';

    // If no news matched, add note
    if(newsArr.length === 0){
      legendHtml += '<div style="font-size:10px;color:var(--muted);margin-top:6px;font-style:italic;">Relancez l\'analyse pour obtenir les actualités associées aux mouvements.</div>';
    }

    legendDiv.innerHTML = legendHtml;
    section.appendChild(legendDiv);
  }
}



// ===== CAUSAL SCORE ENGINE ==================================================
var SECTOR_BENCHMARKS = {
  roe:[-0.10,0.35], grossMargin:[0.10,0.80], pe:[8,45], evEbitda:[4,30],
  fcfGrowth:[-0.20,0.40], revenueGrowth:[-0.10,0.50],
  beta:[0.3,2.5], debtToEquity:[0,3.0], insiderPct:[0,0.30]
};
var GPR_BETA = {
  'Defense':+0.8,'Aeronautique':+0.6,'Energie':+0.5,'Or':+0.7,
  'Luxe':-0.5,'Technologie':-0.3,'Semi-conducteurs':-0.6,
  'Tourisme':-0.5,'Sante':+0.1,'Pharma':+0.1,'Biotech':0.0,'default':0.0
};
function getGPRBeta(sector){
  if(!sector||typeof sector!=='string') return 0;
  var s=sector.toLowerCase();
  for(var k in GPR_BETA){ if(s.indexOf(k.toLowerCase())!==-1) return GPR_BETA[k]; }
  return GPR_BETA['default'];
}
function norm(val,min,max){
  if(val===null||val===undefined||isNaN(val)) return null;
  return Math.max(0,Math.min(100,(val-min)/(max-min)*100));
}
function normInv(val,min,max){ var n=norm(val,min,max); return n!==null?100-n:null; }
function wAvg(pairs){
  var sum=0,tw=0;
  pairs.forEach(function(p){
    if(p.val===null||p.val===undefined) return;
    var w=p.est?p.w*0.5:p.w; sum+=p.val*w; tw+=w;
  });
  return tw>0?Math.round(sum/tw):null;
}
function enrichF(f,r){
  var e=Object.assign({},f);
  var sc=r.smallcap_checklist||{};
  var dims=r.dimensions||[];
  function dScore(n){ var d=dims.find(function(x){return x.name&&x.name.toLowerCase().indexOf(n)!==-1;}); return d?(d.score/5):null; }
  if(e.fcf===null||e.fcf===undefined){ e.fcf=sc.fcf_positif==='oui'?1e6:sc.fcf_positif==='non'?-1e6:null; e._fcf_est=true; }
  if(!e.roe){ var fr=dScore('financ')||dScore('sant'); if(fr!==null) e.roe=(fr-0.5)*0.40; e._roe_est=true; }
  if(!e.beta){ e.beta=1.0; e._beta_est=true; }
  if(!e.per){ var vr=dScore('valoris'); if(vr!==null) e.per=45-vr*37; e._pe_est=true; }
  if(!e.grossMargin){ var br=dScore('business')||dScore('model'); if(br!==null) e.grossMargin=0.10+br*0.60; else if(e.netMargin) e.grossMargin=e.netMargin+0.15; e._margin_est=true; }
  if(!e.insiderPct){ e.insiderPct=sc.dirigeant_actionnaire==='oui'?0.08:sc.dirigeant_actionnaire==='non'?0.01:null; e._ins_est=true; }
  if(!e.debtToEquity){ e.debtToEquity=sc.dette_maitrisee==='oui'?0.8:sc.dette_maitrisee==='non'?2.5:1.5; e._debt_est=true; }
  if(!e.revenueGrowth){ var gr=dScore('crois')||dScore('growth'); if(gr!==null) e.revenueGrowth=gr*0.50-0.10; e._rg_est=true; }
  return e;
}

var POS_PHASE={'Phase I':0.10,'Phase II':0.18,'Phase III':0.58,'Soumis':0.85,'Approuve':1.00};
var PEAK_M={'Phase I':80,'Phase II':300,'Phase III':900,'Soumis':1500,'Approuve':500};

function computeRNPV(pipeline,trials){
  var items=[];
  if(pipeline&&pipeline.length) items=pipeline;
  else if(trials&&trials.length) trials.forEach(function(t){ if(t.phase) items.push({phase:t.phase,status:t.status||'En cours',probability:Math.round((POS_PHASE[t.phase]||0.10)*100)}); });
  if(!items.length) return 30;
  var r2=0.12,total=0;
  items.forEach(function(p){
    if(p.status==='Abandonne') return;
    var pos=p.probability?p.probability/100:(POS_PHASE[p.phase]||0.10);
    var peak=PEAK_M[p.phase]||100;
    var yrs={'Phase I':7,'Phase II':5,'Phase III':2.5,'Soumis':1,'Approuve':0}[p.phase]||5;
    var npv=0; for(var y=0;y<8;y++) npv+=peak*0.15/Math.pow(1+r2,yrs+y);
    total+=npv*pos*(pos<1?1.20:1);
  });
  return Math.min(100,Math.round(total/20));
}

function scoreCalcBiotech(f,r,rtData){
  var fe=enrichF(f,r);
  var rnpv=computeRNPV(r.pipeline||[],(rtData&&rtData.trials)||[]);
  var cash=fe.totalCash||0; var burn=(fe.fcf&&fe.fcf<0)?Math.abs(fe.fcf)/12:3e6;
  var runway=cash>0?cash/burn:null;
  var runwayScore=runway!==null?Math.min(100,Math.round(runway/18*100)):50;
  var clinScore=0;
  (r.pipeline||[]).forEach(function(p){
    if(p.phase==='Phase III'||p.phase==='Soumis') clinScore+=40;
    else if(p.phase==='Phase II') clinScore+=20;
    else if(p.phase==='Phase I')  clinScore+=8;
    if(p.status==='Approuve') clinScore+=30;
  });
  clinScore=Math.min(100,clinScore||30);
  return {score:Math.round(0.5*rnpv+0.3*runwayScore+0.2*clinScore), rnpv:rnpv};
}

function scoreCalcLarge(f,r){
  var fe=enrichF(f,r);
  var quality=wAvg([
    {val:norm(fe.roe,SECTOR_BENCHMARKS.roe[0],SECTOR_BENCHMARKS.roe[1]),w:35,est:fe._roe_est},
    {val:norm(fe.grossMargin,SECTOR_BENCHMARKS.grossMargin[0],SECTOR_BENCHMARKS.grossMargin[1]),w:35,est:fe._margin_est},
    {val:norm(fe.revenueGrowth,SECTOR_BENCHMARKS.revenueGrowth[0],SECTOR_BENCHMARKS.revenueGrowth[1]),w:30,est:fe._rg_est}
  ]);
  var valuation=wAvg([
    {val:normInv(fe.per,SECTOR_BENCHMARKS.pe[0],SECTOR_BENCHMARKS.pe[1]),w:50,est:fe._pe_est},
    {val:normInv(fe.evEbitda,SECTOR_BENCHMARKS.evEbitda[0],SECTOR_BENCHMARKS.evEbitda[1]),w:50}
  ]);
  var stability=wAvg([
    {val:normInv(fe.beta,SECTOR_BENCHMARKS.beta[0],SECTOR_BENCHMARKS.beta[1]),w:50,est:fe._beta_est},
    {val:normInv(fe.debtToEquity,SECTOR_BENCHMARKS.debtToEquity[0],SECTOR_BENCHMARKS.debtToEquity[1]),w:50,est:fe._debt_est}
  ]);
  return wAvg([{val:quality,w:40},{val:valuation,w:30},{val:stability,w:30}]);
}

function scoreCalcSmall(f,r){
  var fe=enrichF(f,r);
  var sc=r.smallcap_checklist||{};
  var growth=wAvg([
    {val:norm(fe.revenueGrowth,SECTOR_BENCHMARKS.revenueGrowth[0],SECTOR_BENCHMARKS.revenueGrowth[1]),w:60,est:fe._rg_est},
    {val:fe.marketCap&&fe.marketCap>0?Math.min(100,1e12/fe.marketCap*10):null,w:40}
  ]);
  var cats=0;
  if(sc.fcf_positif==='oui'||(fe.fcf&&fe.fcf>0)) cats+=30;
  if(sc.dirigeant_actionnaire==='oui'||(fe.insiderPct&&fe.insiderPct>0.05)) cats+=30;
  if(sc.dividende_croissant==='oui') cats+=20;
  if(sc.revenus_recurrents==='oui'||sc.revenus_recurrents==='partiel') cats+=20;
  cats=Math.min(100,cats);
  var liq=wAvg([
    {val:normInv(fe.debtToEquity,SECTOR_BENCHMARKS.debtToEquity[0],SECTOR_BENCHMARKS.debtToEquity[1]),w:50,est:fe._debt_est},
    {val:normInv(fe.beta,SECTOR_BENCHMARKS.beta[0],SECTOR_BENCHMARKS.beta[1]),w:50,est:fe._beta_est}
  ]);
  return wAvg([{val:growth,w:40},{val:cats,w:30},{val:liq,w:30}]);
}

function computeCausalScore(r,rtData){
  var f=(rtData&&rtData.fundamentals)||{};
  var type=selT||'sc';
  var sector=(typeof r.sector==='string'?r.sector:'')|(f.sector||'');
  var gprBeta=getGPRBeta(sector);
  var geoScore=r.geopolitique_score||3;
  var raw, rnpv=null;
  if(type==='bio'){ var bs=scoreCalcBiotech(f,r,rtData); raw=bs.score; rnpv=bs.rnpv; }
  else if(type==='large'){ raw=scoreCalcLarge(f,r); }
  else { raw=scoreCalcSmall(f,r); }
  if(raw===null) return null;
  var geoAdj=(geoScore-3)/10;
  var gprAdj=0.15*gprBeta;
  var final=Math.round(Math.max(0,Math.min(100,raw*(1+gprAdj+geoAdj))));
  return {final_score:final, raw_score:raw, gpr_beta:gprBeta, rnpv:rnpv};
}
// ===========================================================================

// ===== GLOBAL SCORE (3 formules) ===========================================
function computeGlobalScore(r, rtData){
  var f=(rtData&&rtData.fundamentals)||{};
  var type=selT||'sc';
  var isBio=type==='bio';
  var maxIA=isBio?35:40;
  var ia100=Math.round((r.total_score||0)/maxIA*100);
  var cs=computeCausalScore(r,rtData);
  var causal=cs?cs.final_score:50;
  var global, formula_detail, signal, signalCol, signalDesc, components={};

  if(isBio){
    // Catalyst Intensity
    var ci=30;
    var phases=[];
    (r.pipeline||[]).forEach(function(p){ if(p.phase&&p.status!=='Abandonne') phases.push(p.phase); });
    ((rtData&&rtData.trials)||[]).forEach(function(t){ if(t.phase) phases.push(t.phase); });
    if(phases.some(function(p){ return p==='Phase III'||p==='Soumis'||p==='Approuve'; })) ci=80;
    else if(phases.some(function(p){ return p==='Phase II'; })) ci=60;
    // Readout imminent (<6 mois) + Phase 3 → 100
    var now=Date.now();
    var soonP3=(r.key_dates||[]).some(function(d){
      if(!d.date) return false;
      var pts=d.date.split('/'); if(pts.length<3) return false;
      var dt=new Date(pts[2]+'-'+pts[1]+'-'+pts[0]);
      return ((dt-now)/86400000<180)&&ci===80;
    });
    if(soonP3) ci=100;
    // Financial Guardrails
    var fg=50;
    var cash=f.totalCash||0; var burn=(f.fcf&&f.fcf<0)?Math.abs(f.fcf)/12:3e6;
    var runway=cash>0?cash/burn:null;
    if(runway!==null){ fg=runway>=24?90:runway>=18?75:runway>=12?55:25; }
    else { var td=(r.dimensions||[]).find(function(d){return d.name&&d.name.toLowerCase().indexOf('tr')!==-1;}); if(td) fg=td.score>=4?80:td.score===3?55:30; }
    var composite=0.40*ia100+0.30*causal+0.20*ci+0.10*fg;
    // Runway Factor
    var rf=runway!==null?(runway>=24?1.00:runway>=18?0.95:runway>=12?0.90:0.80):1.00;
    global=Math.min(100,Math.max(0,Math.round(composite*rf*10)/10));
    components={ia_qualitatif:ia100,causal_rnpv:causal,catalyst_intensity:ci,financial_guardrails:fg,runway_factor:rf};
    formula_detail='0.40×IA('+ia100+')+0.30×rNPV('+causal+')+0.20×CI('+ci+')+0.10×FG('+fg+')='+Math.round(composite)+'×RF('+rf+')='+global;
  } else {
    global=Math.min(100,Math.max(0,Math.round((0.60*ia100+0.40*causal)*10)/10));
    components={ia_qualitatif:ia100,causal_quant:causal};
    formula_detail=(type==='large'?'Large Cap':'Small Cap')+': 0.60×IA('+ia100+')+0.40×Causal('+causal+')='+global;
  }

  if(global>=85){      signal='Investir';    signalCol='var(--green)'; signalDesc='Fondamentaux solides — conditions réunies.'; }
  else if(global>=75){ signal='Opportunité'; signalCol='var(--amber)'; signalDesc='Bons fondamentaux avec quelques réserves.'; }
  else if(global>=65){ signal='Surveiller';  signalCol='#888';         signalDesc='Points positifs mais trop d\'incertitudes.'; }
  else {               signal='Éviter';       signalCol='var(--red)';   signalDesc='Fondamentaux insuffisants.'; }

  return {global,signal,signalCol,signalDesc,formula_detail,components,
          is_biotech:isBio,ia_base:ia100,causal_quant:causal,
          gpr_beta:cs?(cs.gpr_beta||0):0};
}
// ===========================================================================

// ===== SIGNAUX INDICATEURS =================================================
function computeSignals(r, rtData){
  var f=(rtData&&rtData.fundamentals)||{};
  var news=(rtData&&rtData.news)||[];
  var newsText=news.map(function(n){ return ((n.title||'')+(n.description||'')).toLowerCase(); }).join(' ');
  var tavilyText=((rtData&&rtData.tavilyAnswer)||'').toLowerCase();
  var dims=r.dimensions||[];
  function getDim(kw){ var d=dims.find(function(x){return x.name&&x.name.toLowerCase().indexOf(kw)!==-1;}); return d?d.score:null; }

  // 1. Volume Spike (>3× moy 20j) — proxy: dim Liquidité IA
  var liq=getDim('liquidit')||getDim('volume');
  var volGreen=!!(liq&&liq>=4);
  var volGrey=!!(liq&&liq===3);

  // 2. Insider Net Buying (>3% flottant 60j)
  var insiderPct=f.insiderPct;
  var sc=r.smallcap_checklist||{};
  var insiderChk=sc.dirigeant_actionnaire==='oui';
  var insGreen=!!(insiderPct&&insiderPct>0.03)||insiderChk;
  var insGrey=!!(!insGreen&&insiderPct!==null&&insiderPct!==undefined);

  // 3. RSI(14)<50 + cours<MM50 — proxy: dim Valorisation + PER
  var valScore=getDim('valoris');
  var per=f.per; var beta=f.beta;
  var valAttr=!!(((per&&per<20)||(f.evEbitda&&f.evEbitda<12)||(valScore&&valScore>=4)));
  var lowVol=!beta||beta<1.2;
  var rsiGreen=!!(valAttr&&lowVol);
  var rsiGrey=!!(valAttr&&!lowVol);

  // 4. Analyst Upgrades nets (≥2 en 30j)
  var upWords=['upgrade','buy','outperform','overweight','acheter','surperformer','releve','hausse cible'];
  var dnWords=['downgrade','sell','underperform','underweight','vendre','abaisse'];
  var ups=0,dns=0;
  upWords.forEach(function(w){ if(newsText.indexOf(w)!==-1) ups++; });
  dnWords.forEach(function(w){ if(newsText.indexOf(w)!==-1) dns++; });
  if(tavilyText.indexOf('upgrade')!==-1||tavilyText.indexOf('acheter')!==-1) ups++;
  var net=ups-dns;
  var upgGreen=net>=2, upgGrey=net===1;

  var sigs=[
    {key:'volume',  label:'Volume Spike',        green:volGreen, grey:volGrey,
     desc:liq?'Liquidité IA : '+liq+'/5'+(volGreen?' ✓':''):'Non disponible',
     threshold:'>3× vol. moy. 20j', impact:'Confirme la force du mouvement'},
    {key:'insider', label:'Insider Net Buying',   green:insGreen, grey:insGrey,
     desc:insiderPct?'Insiders : '+(insiderPct*100).toFixed(1)+'%'+(insGreen?' ✓':'')
          :insiderChk?'Dirigeant actionnaire ✓':'Non disponible',
     threshold:'>3% flottant sur 60j', impact:'+10-15 pts de confiance'},
    {key:'rsi',     label:'RSI(14) + MM50',       green:rsiGreen, grey:rsiGrey,
     desc:per?'PER '+per.toFixed(1)+'x'+(rsiGreen?' · attractif ✓':' · tendu')
          :valScore?'Valorisation IA : '+valScore+'/5':'Non disponible',
     threshold:'RSI<50 ET cours<MM50', impact:'Renforce le timing d\'entrée'},
    {key:'upgrades',label:'Analyst Upgrades',     green:upgGreen, grey:upgGrey,
     desc:news.length?(net>=2?'≥2 signaux haussiers ✓':net===1?'1 signal':net<0?'Signaux baissiers':'Neutre'):'Pas de données news',
     threshold:'≥2 upgrades nets 30j', impact:'Confirme le momentum externe'}
  ];

  var greenCount=sigs.filter(function(s){ return s.green; }).length;
  var gs=window._lastGlobalScore;
  var confiance=!!(gs&&gs.global>=80&&greenCount>=2);
  return {sigs:sigs, greenCount:greenCount, confiance:confiance};
}

function renderSignals(r){
  var sec=document.getElementById('signals-section');
  if(!sec) return;
  var res=computeSignals(r,window._rtData||{});
  sec.style.display='block';
  var html='<div class="seclbl" style="margin-top:0;">Signaux indicateurs</div>';
  if(res.confiance){
    html+='<div class="confiance-badge">'
      +'<span style="font-size:20px;">🚀</span>'
      +'<div><div style="font-size:13px;font-weight:800;">Signal Confiance Fort</div>'
      +'<div style="font-size:11px;opacity:.9;">Global Score ≥ 80 ET '+res.greenCount+'/4 signaux verts</div>'
      +'</div></div>';
  }
  html+='<div class="signals-grid">';
  res.sigs.forEach(function(s){
    var cls=s.green?'green':s.grey?'grey':'grey';
    var icol=s.green?'#3B6D11':'#888';
    var icon=s.green?'✓':'·';
    html+='<div class="sig-card '+cls+'">'
      +'<div style="display:flex;align-items:center;gap:5px;margin-bottom:4px;">'
        +'<span style="font-size:12px;font-weight:800;color:'+icol+'">'+icon+'</span>'
        +'<span class="sig-label">'+s.label+'</span>'
      +'</div>'
      +'<div class="sig-desc">'+s.desc+'</div>'
      +'<div class="sig-desc" style="color:var(--muted);margin-top:2px;">Seuil : '+s.threshold+'</div>'
      +'<div class="sig-impact" style="color:'+icol+'">'+s.impact+'</div>'
      +'</div>';
  });
  html+='</div>';
  var sumCol=res.greenCount>=3?'#3B6D11':res.greenCount>=2?'#BA7517':'#888';
  html+='<div style="font-size:11px;color:var(--muted);text-align:right;margin-top:4px;">'
    +'<span style="font-weight:700;color:'+sumCol+'">'+res.greenCount+'/4 signaux positifs</span>'
    +' — Badge Signal Confiance Fort si Global Score ≥ 80 ET ≥ 2 verts</div>';
  sec.innerHTML=html;
}
// ===========================================================================


// ── PEG Ratio display ──────────────────────────────────────────────────────
function renderPEG(selT, f){
  var box   = document.getElementById('peg-display');
  var valEl = document.getElementById('peg-value');
  var lblEl = document.getElementById('peg-label');
  if(!box||!valEl||!lblEl) return;

  // Biotech: N/A
  if(selT === 'bio'){
    box.style.display='block'; box.style.background='var(--bg2)'; box.style.borderColor='var(--border)';
    valEl.textContent='N/A'; valEl.style.color='var(--muted)';
    lblEl.textContent='Non applicable (pré-revenue ou pertes)'; lblEl.style.color='var(--muted)';
    return;
  }

  var peg = null;
  var source = '';

  // Cascade 1: PEG direct Yahoo
  if(f.peg && !isNaN(f.peg) && f.peg>0 && f.peg<50){
    peg=f.peg; source='Yahoo';
  }

  // Cascade 2: forwardPE / epsGrowthFwd (earningsTrend — most reliable for EU)
  if(!peg && f.per && f.epsGrowthFwd && f.epsGrowthFwd>0){
    peg = f.per / (f.epsGrowthFwd*100); source='PER÷EPS%';
  }

  // Cascade 3: forwardPE / earningsGrowth TTM
  if(!peg && f.per && f.earningsGrowth && f.earningsGrowth>0){
    peg = f.per / (f.earningsGrowth*100); source='PER÷BPA%';
  }

  // Cascade 4: trailingPE / epsGrowthFwd
  if(!peg && f.perTrailing && f.epsGrowthFwd && f.epsGrowthFwd>0){
    peg = f.perTrailing / (f.epsGrowthFwd*100); source='PERt÷EPS%';
  }

  // Cascade 5: trailingPE / earningsGrowth TTM
  if(!peg && f.perTrailing && f.earningsGrowth && f.earningsGrowth>0){
    peg = f.perTrailing / (f.earningsGrowth*100); source='PERt÷BPA%';
  }

  // Cascade 6: forwardPE / earningsGrowthQuarterly%
  if(!peg && f.per && f.earningsGrowthQ && f.earningsGrowthQ>0){
    peg = f.per / (f.earningsGrowthQ*100); source='PER÷BPAq%';
  }

  // Cascade 7: forwardPE / revenueGrowth%
  if(!peg && f.per && f.revenueGrowth && f.revenueGrowth>0){
    peg = f.per / (f.revenueGrowth*100); source='PER÷CA%';
  }

  // Cascade 8: trailingPE / revenueGrowth%
  if(!peg && f.perTrailing && f.revenueGrowth && f.revenueGrowth>0){
    peg = f.perTrailing / (f.revenueGrowth*100); source='PERt÷CA%';
  }

  // Cascade 9: price / forwardEps / epsGrowthFwd (manual PEG)
  if(!peg && f.price && f.forwardEps && f.forwardEps>0 && f.epsGrowthFwd && f.epsGrowthFwd>0){
    var fwdPE = f.price / f.forwardEps;
    peg = fwdPE / (f.epsGrowthFwd*100); source='Prix÷EPS%';
  }

  // Sanity check — allow up to 100 for high-growth stocks
  if(peg && (peg<=0 || peg>100 || isNaN(peg))) peg=null;

  box.style.display='block';

  if(!peg){
    box.style.borderColor='var(--border)';
    valEl.textContent='N/D'; valEl.style.color='var(--muted)';
    lblEl.textContent='PER ou croissance non disponibles'; lblEl.style.color='var(--muted)';
    return;
  }

  // Thresholds
  var isLarge = selT==='large';
  var color, label;
  if(isLarge){
    if(peg<1.0)      {color='var(--green)';label='Très attractif';}
    else if(peg<1.5) {color='var(--amber)';label='Correct / Attractif';}
    else             {color='var(--red)';  label='Surévalué';}
  } else {
    if(peg<0.8)      {color='var(--green)';label='Très attractif';}
    else if(peg<1.2) {color='var(--amber)';label='Correct / Attractif';}
    else             {color='var(--red)';  label='Surévalué';}
  }

  box.style.borderColor=color;
  valEl.textContent=peg.toFixed(2)+(source!=='Yahoo'?' *':'');
  valEl.style.color=color;
  lblEl.textContent='→ '+label+(source!=='Yahoo'?' (estimé)':'');
  lblEl.style.color=color;
}

// ──────────────────────────────────────────────────────────────────────────

function renderAnalysis(r){
  const ratio=r.total_score/r.max_score;
  document.getElementById('coN').textContent=r.company_name;
  document.getElementById('coM').textContent=`${r.ticker}  ·  ${r.sector}  ·  ${r.country}  ·  ${r.market_cap}`;
  const p=document.getElementById('coP');
  var typeLabel = selT==='bio'?'Biotech / Medtech': selT==='large'?'Large Cap (>10Md$)':'Small Cap (<2Md$)';
  p.textContent=typeLabel;
  p.className='co-pill '+(selT==='bio'?'bio':'sc');
  var _gs = computeGlobalScore(r, window._rtData||{});
  window._lastGlobalScore = _gs;
  // Render PEG right after global score
  renderPEG(selT, (window._rtData&&window._rtData.fundamentals)||{});
  if(_gs){
    document.getElementById('sn').textContent = _gs.global;
    document.getElementById('sd').textContent = '/100';
    document.getElementById('sr').className = 'sring '+(_gs.global>=85?'high':_gs.global>=65?'mid':'low');
  } else {
    document.getElementById('sn').textContent=r.total_score;
    document.getElementById('sd').textContent='/'+r.max_score;
    document.getElementById('sr').className='sring '+(ratio>=.75?'high':ratio>=.55?'mid':'low');
  }
  document.getElementById('coV').innerHTML=`<span class="vbadge ${vc(r.verdict)}">${vl(r.verdict)}</span>`;
  document.getElementById('coS').textContent=r.summary;
  renderSignals(r);
  const fb=document.getElementById('favBtn');
  fb.disabled=favs.some(f=>f.company_name===r.company_name);
  fb.textContent=fb.disabled?'* Déjà en favoris':'* Ajouter aux favoris';
  // Indicators
  const geo=r.geopolitique_score||3,mom=r.momentum_score||3;
  const gC=geo>=4?'g':geo<=2?'r':'',mC=mom>=4?'g':mom<=2?'r':'';
  const up=r.upside_12m||'N/A',upN=parseFloat(up);
  const upC=upN>0?'#3B6D11':upN<0?'#A32D2D':'#854F0B';
  const tim=r.timing||'ATTENDRE';
  const tM={MAINTENANT:'now',ATTENDRE:'wait',TROP_TARD:'late',EVITER:'nev'};
  // PEG (Large Cap + Small Cap uniquement)
  var pegHtml='';
  if(selT!=='bio'){
    var rtF=(window._rtData&&window._rtData.fundamentals)||{};
    var pegVal=rtF.peg;
    if(pegVal&&!isNaN(pegVal)){
      var pegC=pegVal<1?'var(--green)':pegVal<2?'var(--amber)':'var(--red)';
      var pegLbl=pegVal<1?'Sous-évalué':pegVal<1.5?'Attractif':pegVal<2?'Raisonnable':pegVal<3?'Cher':'Très cher';
      var pegDesc=pegVal<1?'PEG < 1 — croissance pas encore pricee, potentiel haussier':
                  pegVal<2?'PEG 1-2 — valorisation en ligne avec la croissance':
                  'PEG > 2 — marche paie cher la croissance, exigeant';
      pegHtml='<div class="ind"><div class="ind-lbl">PEG Ratio</div>'
        +'<div class="ind-val" style="color:'+pegC+'">'+pegVal.toFixed(2)+'</div>'
        +'<div class="ind-note" style="font-weight:700;color:'+pegC+'">'+pegLbl+'</div>'
        +'<div class="ind-note">'+pegDesc+'</div></div>';
    }
  }
  document.getElementById('inds').innerHTML=`
    <div class="ind"><div class="ind-lbl">Géopolitique</div>${starsH(geo,5,gC)}<div class="ind-note">${r.geopolitique_note||''}</div></div>
    <div class="ind"><div class="ind-lbl">Momentum</div>${starsH(mom,5,mC)}<div class="ind-note">${r.momentum_note||''}</div></div>
    <div class="ind"><div class="ind-lbl">Potentiel 12 mois</div><div class="ind-val" style="color:${upC}">${up}</div><div class="ind-note">${r.upside_note||''}</div></div>
    <div class="ind"><div class="ind-lbl">Timing d'entrée</div><div style="margin-bottom:3px"><span class="timbadge ${tM[tim]||'wait'}">${tim.replace('_',' ')}</span></div><div class="ind-note">${r.timing_note||''}</div></div>`
  + pegHtml;
  // Dims
  const dg=document.getElementById('dims');dg.innerHTML='';
  (r.dimensions||[]).forEach(d=>{
    const pct=Math.round(d.score/d.max*100),col=sc(d.score);
    const el=(d.is_eliminatoire&&d.score<=1)?'<span class="elim">ELIMINATOIRE !</span>':'';
    const row=document.createElement('div');row.className='dim';
    row.innerHTML=`<div><div class="dim-name">${d.name}${el}</div><div class="dim-note">${d.note}</div></div><div class="bwrap"><div class="bbg"><div class="bfill" data-p="${pct}" style="background:${col}"></div></div></div><div class="dscore" style="color:${col}">${d.score}/${d.max}</div>`;
    dg.appendChild(row);
  });
  requestAnimationFrame(()=>document.querySelectorAll('.bfill').forEach(e=>e.style.width=e.dataset.p+'%'));
  // News
  const nl=document.getElementById('news');nl.innerHTML='';
  (r.news||[]).forEach(n=>{
    const ni=document.createElement('div');ni.className='news-item';
    ni.innerHTML=`<div class="ndot ${n.impact}"></div><div class="nbody"><div class="ntitle">${n.title}<span class="nimp ${n.impact}">${n.impact==='pos'?'Positif':n.impact==='neg'?'Négatif':'Neutre'}</span></div><div class="ndetail">${n.detail}</div></div>`;
    nl.appendChild(ni);
  });
  // News: use JS real-time news if available, fall back to IA news
  var nlEl = document.getElementById('news');
  var hasRtNews = nlEl && nlEl.querySelectorAll('.news-item').length > 0;
  if(!hasRtNews && r.news && r.news.length){
    nlEl.innerHTML = '';
    var iaNotice = document.createElement('div');
    iaNotice.style.cssText = 'font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--amber);margin-bottom:6px;padding-bottom:5px;border-bottom:1px solid var(--border);';
    iaNotice.textContent = 'Source : Memoire IA (Yahoo Finance indisponible pour cette valeur)';
    nlEl.appendChild(iaNotice);
    r.news.forEach(function(n){
      var ni = document.createElement('div');
      ni.className = 'news-item';
      var impCls = n.impact==='pos'?'pos':n.impact==='neg'?'neg':'neu';
      ni.innerHTML = '<div class="ndot '+impCls+'"></div><div class="nbody"><div class="ntitle">'+n.title
        +'<span class="nimp '+impCls+'">'+(n.impact==='pos'?'Positif':n.impact==='neg'?'Negatif':'Neutre')+'</span></div>'
        +(n.detail?'<div class="ndetail">'+n.detail+'</div>':'')+'</div>';
      nlEl.appendChild(ni);
    });
  }
  // Sources
  const se=document.getElementById('sources');se.innerHTML='<span class="src-lbl">Sources :</span>';
  (r.sources||['Yahoo Finance','Reuters']).forEach(s=>se.innerHTML+=`<span class="src-tag">${s}</span>`);
  // KPs
  const kg=document.getElementById('kps');kg.innerHTML='';
  [['pos','Points forts',r.strengths],['neg','Risques',r.risks],['warn','Vigilance',r.warnings]].forEach(([cls,t,items])=>{
    if(!items?.length)return;
    const c=document.createElement('div');c.className='kp '+cls;
    c.innerHTML=`<div class="kp-t">${t}</div><ul>${items.map(i=>`<li>${i}</li>`).join('')}</ul>`;
    kg.appendChild(c);
  });
  // Roadmap + dates
  renderRoadmap(r);
  renderDates(r);
  // Checklists
  renderPriceChart(r);
  renderBiotechChecklist(r);
  renderScChecklist(r);
  document.getElementById('res').classList.add('on');
  document.getElementById('res').scrollIntoView({behavior:'smooth'});
}

function renderBiotechChecklist(r){
  var sec = document.getElementById('bio-check-section');
  var grid = document.getElementById('bio-check-grid');
  if(r.type !== 'biotech' || !r.biotech_checklist){
    sec.style.display = 'none';
    return;
  }
  sec.style.display = 'block';
  var c = r.biotech_checklist;
  var items = [
    {
      label: 'Startup',
      val: c.is_startup,
      detail: c.is_startup_detail,
      yes_is_good: false,
      yes_label: 'Oui - startup',
      no_label: 'Non - entreprise etablie'
    },
    {
      label: 'Revenus recurrents',
      val: c.revenus_recurrents,
      detail: c.revenus_recurrents_detail,
      yes_is_good: true,
      yes_label: 'Oui',
      no_label: 'Non',
      partial_label: 'Partiels'
    },
    {
      label: 'Obtention FDA',
      val: c.fda_obtenu,
      detail: c.fda_detail,
      yes_is_good: true,
      yes_label: 'Obtenu',
      no_label: 'Non obtenu',
      partial_label: 'En cours'
    },
    {
      label: 'Marquage CE',
      val: c.marquage_ce,
      detail: c.marquage_ce_detail,
      yes_is_good: true,
      yes_label: 'Obtenu',
      no_label: 'Non obtenu',
      partial_label: 'En cours'
    },
    {
      label: 'Performances cliniques',
      val: c.performance_clinique ? 'data' : 'non',
      detail: (c.performance_clinique ? c.performance_clinique + ' - ' : '') + (c.performance_clinique_detail||''),
      yes_is_good: true,
      custom_icon: c.performance_clinique ? 'partial' : 'no',
      custom_label: c.performance_clinique || 'Non disponible'
    },
    {
      label: 'Dispositif unique sur le marche',
      val: c.dispositif_unique,
      detail: c.dispositif_unique_detail,
      yes_is_good: true,
      yes_label: 'Oui - unique',
      no_label: 'Non unique',
      partial_label: 'Partiellement'
    },
    {
      label: 'Cadre de remboursement etabli',
      val: c.remboursement_etabli,
      detail: c.remboursement_detail,
      yes_is_good: true,
      yes_label: 'Etabli',
      no_label: 'Non etabli',
      partial_label: 'En cours'
    }
  ];

  grid.innerHTML = '';
  items.forEach(function(item){
    var v = (item.val||'').toLowerCase();
    var iconCls, iconTxt, labelTxt;

    if(item.custom_icon){
      iconCls = item.custom_icon;
      iconTxt = item.custom_icon === 'partial' ? '%' : '?';
      labelTxt = item.custom_label;
    } else if(v === 'oui' || v === 'obtenu'){
      iconCls = item.yes_is_good ? 'yes' : 'no';
      iconTxt = item.yes_is_good ? 'V' : '!';
      labelTxt = item.yes_label || 'Oui';
    } else if(v === 'non'){
      iconCls = item.yes_is_good ? 'no' : 'yes';
      iconTxt = item.yes_is_good ? 'X' : 'V';
      labelTxt = item.no_label || 'Non';
    } else if(v === 'partiel' || v === 'partiellement' || v === 'en_cours' || v === 'en cours'){
      iconCls = 'partial';
      iconTxt = '~';
      labelTxt = item.partial_label || 'Partiel';
    } else {
      iconCls = 'na';
      iconTxt = '?';
      labelTxt = item.val || 'Non renseigne';
    }

    var el = document.createElement('div');
    el.className = 'bio-check-item';
    el.innerHTML =
      '<div class="bci-icon ' + iconCls + '">' + iconTxt + '</div>'
      + '<div class="bci-body">'
        + '<div class="bci-label">' + item.label + ' : <strong>' + labelTxt + '</strong></div>'
        + (item.detail ? '<div class="bci-detail">' + item.detail + '</div>' : '')
      + '</div>';
    grid.appendChild(el);
  });
}

function renderScChecklist(r){
  var sec = document.getElementById('sc-check-section');
  var grid = document.getElementById('sc-check-grid');
  if(r.type !== 'smallcap' || !r.smallcap_checklist){
    sec.style.display = 'none';
    return;
  }
  sec.style.display = 'block';
  var c = r.smallcap_checklist;

  var items = [
    {
      label: 'Free Cash Flow positif',
      val: c.fcf_positif,
      detail: c.fcf_detail,
      yes_good: true,
      yes_label: 'Oui - FCF positif',
      no_label: 'Non - FCF negatif'
    },
    {
      label: 'Dette maitrisee (< 2x EBITDA)',
      val: c.dette_maitrisee,
      detail: c.dette_detail,
      yes_good: true,
      yes_label: 'Oui - sous controle',
      no_label: 'Non - levier eleve'
    },
    {
      label: 'Dirigeant actionnaire (> 5%)',
      val: c.dirigeant_actionnaire,
      detail: c.dirigeant_detail,
      yes_good: true,
      yes_label: 'Oui - aligne',
      no_label: 'Non - pas de skin in the game'
    },
    {
      label: 'Revenus recurrents (> 50% CA)',
      val: c.revenus_recurrents,
      detail: c.revenus_detail,
      yes_good: true,
      yes_label: 'Oui',
      no_label: 'Non',
      partial_label: 'Partiels'
    },
    {
      label: 'Concentration client acceptable',
      val: c.concentration_client === 'ok' ? 'oui' : c.concentration_client === 'risque' ? 'non' : c.concentration_client,
      detail: c.concentration_detail,
      yes_good: true,
      yes_label: 'OK - client max < 20% CA',
      no_label: 'Risque - forte concentration'
    },
    {
      label: 'Dividende verse et croissant',
      val: c.dividende_croissant,
      detail: c.dividende_detail,
      yes_good: true,
      yes_label: 'Oui - croissant',
      no_label: 'Non verse',
      partial_label: 'Stable / en pause'
    },
    {
      label: 'Profit warning recent',
      val: c.profit_warning,
      detail: c.profit_warning_detail,
      yes_good: false,
      yes_label: 'Oui - signal negatif',
      no_label: 'Non - gestion stable'
    }
  ];

  grid.innerHTML = '';
  items.forEach(function(item){
    var v = (item.val||'').toLowerCase().trim();
    var iconCls, iconTxt, labelTxt;

    if(v === 'oui'){
      iconCls = item.yes_good ? 'yes' : 'no';
      iconTxt = item.yes_good ? 'V' : '!';
      labelTxt = item.yes_label || 'Oui';
    } else if(v === 'non'){
      iconCls = item.yes_good ? 'no' : 'yes';
      iconTxt = item.yes_good ? 'X' : 'V';
      labelTxt = item.no_label || 'Non';
    } else if(v === 'partiel' || v === 'partiellement' || v === 'absent' || v === 'stable'){
      iconCls = 'partial';
      iconTxt = '~';
      labelTxt = item.partial_label || v;
    } else {
      iconCls = 'na';
      iconTxt = '?';
      labelTxt = item.val || 'Non renseigne';
    }

    var el = document.createElement('div');
    el.className = 'bio-check-item';
    el.innerHTML =
      '<div class="bci-icon ' + iconCls + '">' + iconTxt + '</div>'
      + '<div class="bci-body">'
        + '<div class="bci-label">' + item.label + ' : <strong>' + labelTxt + '</strong></div>'
        + (item.detail ? '<div class="bci-detail">' + item.detail + '</div>' : '')
      + '</div>';
    grid.appendChild(el);
  });
}

// -- FAVORIS ---------------------------------------------------------------
function addToFavs(){
  if(!lastResult||favs.some(f=>f.company_name===lastResult.company_name))return;
  favs.push({...lastResult});save('ss_favs',favs);updateCounts();updateDataSummary();renderFavs();
  document.getElementById('favBtn').textContent='* Déjà en favoris';
  document.getElementById('favBtn').disabled=true;
}
function removeFav(name){favs=favs.filter(f=>f.company_name!==name);save('ss_favs',favs);updateCounts();updateDataSummary();renderFavs();}
function renderFavs(){
  updateCounts();
  const empty=document.getElementById('favs-empty'),grid=document.getElementById('favs-grid');
  if(!favs.length){empty.style.display='block';grid.innerHTML='';return;}
  empty.style.display='none';grid.innerHTML='';
  favs.forEach(r=>{
    const ratio=r.total_score/r.max_score;
    const col=ratio>=.75?'#3B6D11':ratio>=.55?'#BA7517':'#A32D2D';
    const card=document.createElement('div');card.className='mini-card';
    const favSafeId = 'f' + favs.indexOf(r);
    card.innerHTML=
      '<button class="mini-del" data-action="del" data-safe="'+favSafeId+'">x</button>'
      +'<div class="mini-name">'+r.company_name+'</div>'
      +'<div class="mini-meta">'+r.ticker+'</div>'
      +'<div class="mini-score-row"><span class="mini-score-num" style="color:'+col+'">'+r.total_score+'</span><span class="mini-score-den">/'+r.max_score+'</span><span class="mini-verdict '+vc(r.verdict)+'">'+vl(r.verdict)+'</span></div>'
      +'<div class="health-bar"><div class="health-lbl"><span>Santé globale</span><span>'+Math.round(ratio*100)+'%</span></div><div class="health-bg"><div class="health-fill" style="width:'+Math.round(ratio*100)+'%;background:'+col+'"></div></div></div>'
      +'<div class="mini-type">'+(r.type==='biotech'?'Biotech':'Small Cap')+' · '+(r.sector||'--')+'</div>'
      +'<div class="mini-date">Analysé le '+(r.analyzed_at||'--')+'</div>'
      +'<div id="fav-status-'+favSafeId+'" style="display:none;font-size:11px;font-weight:600;padding:5px 9px;border-radius:6px;margin:6px 0;"></div>'
      +'<button class="mini-reanal" data-action="update" data-safe="'+favSafeId+'">Actualiser analyse</button>';
    card.dataset.name = r.company_name;
    card.dataset.safe = favSafeId;
    grid.appendChild(card);
  });
}

// -- SECTOR DIVERSIFICATION CHART ------------------------------------------
var SECTOR_COLORS = [
  '#185FA5','#0F6E56','#854F0B','#A32D2D','#534AB7',
  '#639922','#993C1D','#3B6D11','#72243E','#444441',
  '#0F6E56','#185FA5','#854F0B','#534AB7','#A32D2D'
];

// Target allocation defined by user
var TARGET_ALLOC = {
  'Technologie':            30,
  'Sante':                  20,
  'Defense':                15,
  'Energies renouvelables': 15,
  'Services financiers':    10,
  'Industrie et logistique':10
};
var TARGET_COLORS = {
  'Technologie':            '#185FA5',
  'Sante':                  '#0F6E56',
  'Defense':                '#534AB7',
  'Energies renouvelables': '#3B6D11',
  'Services financiers':    '#854F0B',
  'Industrie et logistique':'#A32D2D',
  'Autre':                  '#888780'
};

// Map any sector string to one of the 6 target categories
function mapSectorToCategory(s){
  if(!s) return 'Autre';
  var sl = s.toLowerCase();
  if(sl.match(/tech|it|logiciel|software|ia|intelligence|cloud|cyber|digital|num/)) return 'Technologie';
  if(sl.match(/sant|pharma|bio|medtech|medic|health|diagnos|therape/)) return 'Sante';
  if(sl.match(/def|defense|armement|aero|spatial|securit|militaire/)) return 'Defense';
  if(sl.match(/energ|solaire|eolien|renouv|hydrog|vert|transition|climat/)) return 'Energies renouvelables';
  if(sl.match(/financ|banque|assur|invest|capital|bourse|payment|paiement/)) return 'Services financiers';
  if(sl.match(/industri|logisti|transport|manufactur|construct|materiaux|chimie/)) return 'Industrie et logistique';
  return 'Autre';
}

function renderSectorChart(){
  var chart   = document.getElementById('sector-chart');
  var rowsEl  = document.getElementById('sector-rows');
  var alertEl = document.getElementById('sector-alert');
  var scoreEl = document.getElementById('div-score-val');
  var tipEl   = document.getElementById('div-score-tip');
  if(!port.length){ chart.style.display='none'; return; }

  // Aggregate by canonical sector
  var sectors = {};
  var totalVal = 0;
  Object.keys(TARGET_ALLOC).forEach(function(k){ sectors[k]={count:0,value:0}; });
  sectors['Autre'] = {count:0,value:0};

  port.forEach(function(p){
    var raw = p.sector || '';
    var cat = mapSectorToCategory(raw);
    if(!sectors[cat]) sectors[cat]={count:0,value:0};
    sectors[cat].count++;
    var val=(p.buy_price&&p.qty)?p.buy_price*p.qty:0;
    sectors[cat].value+=val;
    totalVal+=val;
  });

  var useValue = totalVal > 0;
  var sorted = Object.keys(sectors).map(function(name){
    var pct = useValue
      ? (sectors[name].value/totalVal*100)
      : (sectors[name].count/port.length*100);
    return {name:name, count:sectors[name].count, value:sectors[name].value, pct:pct, target:TARGET_ALLOC[name]||0};
  }).sort(function(a,b){ return (b.target||0)-(a.target||0); });

  // Build rows — current vs target
  rowsEl.innerHTML = '';
  sorted.forEach(function(s){
    if(s.count===0 && s.target===0) return;
    var col   = TARGET_COLORS[s.name] || '#888780';
    var diff  = s.pct - (s.target||0);
    var diffTxt = s.target ? (diff>=0?'+':'')+diff.toFixed(1)+'%' : '';
    var diffCol = diff > 3 ? '#A32D2D' : diff < -3 ? '#854F0B' : '#3B6D11';
    var row = document.createElement('div');
    row.className = 'sector-row';
    row.style.gridTemplateColumns = '130px 1fr 44px 44px 54px';
    // Dual bar: target (light) + current (solid)
    var targetW = s.target || 0;
    var currentW = s.pct;
    row.innerHTML =
      '<div class="sector-name" title="'+s.name+'">'+s.name+'</div>'
      +'<div class="sector-bar-bg" style="position:relative;height:10px;">'
        +'<div style="position:absolute;left:0;top:0;height:100%;width:'+targetW+'%;background:'+col+';opacity:0.2;border-radius:3px;"></div>'
        +'<div class="sector-bar-fill" data-w="'+currentW.toFixed(1)+'" style="background:'+col+';width:0%;height:100%;border-radius:3px;position:relative;z-index:1;transition:width .6s cubic-bezier(.22,1,.36,1);"></div>'
      +'</div>'
      +'<div class="sector-pct" style="color:'+col+'">'+currentW.toFixed(1)+'%</div>'
      +'<div style="font-size:10px;color:var(--muted);text-align:right;">cible '+targetW+'%</div>'
      +'<div style="font-size:11px;font-weight:700;text-align:right;color:'+diffCol+';">'+diffTxt+'</div>';
    rowsEl.appendChild(row);
  });

  requestAnimationFrame(function(){
    rowsEl.querySelectorAll('.sector-bar-fill').forEach(function(el){
      el.style.width = el.dataset.w+'%';
    });
  });

  // Score: based on deviation from target (not HHI)
  var totalDeviation = 0;
  var maxPossibleDev = 0;
  Object.keys(TARGET_ALLOC).forEach(function(k){
    var actual = sectors[k] ? (useValue ? sectors[k].value/totalVal*100 : sectors[k].count/port.length*100) : 0;
    var target = TARGET_ALLOC[k];
    totalDeviation += Math.abs(actual - target);
    maxPossibleDev += target;
  });
  var divScore = Math.max(0, Math.round(100 - totalDeviation));
  var scoreCls = divScore>=80?'good':divScore>=55?'med':'bad';
  scoreEl.textContent = divScore+'/100';
  scoreEl.className = 'div-score-val '+scoreCls;

  // Recommendations: sectors to add
  var recs = [];
  Object.keys(TARGET_ALLOC).forEach(function(k){
    var actual = sectors[k] ? (useValue ? sectors[k].value/totalVal*100 : sectors[k].count/port.length*100) : 0;
    var diff = actual - TARGET_ALLOC[k];
    if(diff < -5) recs.push({sector:k, gap: Math.abs(diff).toFixed(1)});
  });
  recs.sort(function(a,b){return b.gap-a.gap;});

  if(recs.length){
    alertEl.style.display='block';
    alertEl.style.background='var(--amber-bg)';
    alertEl.style.color='var(--amber)';
    alertEl.innerHTML = '<strong>Pour equilibrer :</strong> Renforce '
      + recs.map(function(r){ return '<strong>'+r.sector+'</strong> (manque '+r.gap+'%)'; }).join(', ')
      + '.';
  } else if(divScore >= 80){
    alertEl.style.display='block';
    alertEl.style.background='var(--green-bg)';
    alertEl.style.color='var(--green)';
    alertEl.textContent = 'Portefeuille bien equilibre selon tes cibles !';
  } else {
    alertEl.style.display='none';
  }

  tipEl.textContent = 'vs cibles : Tech 30% | Sante 20% | Defense 15% | EnR 15% | Finance 10% | Industrie 10%';
  chart.style.display='block';
}


// -- PORTEFEUILLE ----------------------------------------------------------
function addToPortfolio(){
  if(!lastResult)return;
  const name=lastResult.company_name;
  document.getElementById('pf-name').value=name;
  document.getElementById('pf-ticker').value=lastResult.ticker_yahoo||lastResult.ticker?.split(' ')[0]||'';
  document.getElementById('pf-date').value=new Date().toISOString().split('T')[0];
  // Pre-select sector from analysis
  var autoSector = mapSectorToCategory(lastResult.sector||'');
  var sel = document.getElementById('pf-sector');
  if(sel && autoSector) sel.value = autoSector;
  localStorage.setItem('ss_pending',JSON.stringify(lastResult));
  switchTab('port');
  document.getElementById('pf-buy').focus();
}

async function addPortManual(){
  const name=document.getElementById('pf-name').value.trim();
  const ticker=document.getElementById('pf-ticker').value.trim().toUpperCase();
  const buy=parseFloat(document.getElementById('pf-buy').value);
  const qty=parseInt(document.getElementById('pf-qty').value);
  const dt=document.getElementById('pf-date').value;
  const sectorInput=document.getElementById('pf-sector').value;
  if(!name){alert('Indique le nom de la societe.');return;}
  if(!sectorInput){alert('Choisis un secteur pour cette position.');return;}
  if(!ticker){alert('Ticker Yahoo Finance obligatoire (ex: ALMDT.PA, AAPL).');return;}
  if(isNaN(buy)||buy<=0){alert('Prix achat obligatoire pour la plus-value.');return;}
  if(isNaN(qty)||qty<=0){alert('Nombre actions obligatoire pour la plus-value.');return;}

  // Show loading on button
  var btn = document.querySelector('.form-btn');
  var oldTxt = btn ? btn.textContent : '';
  if(btn){ btn.disabled=true; btn.textContent='Récupération du cours...'; }

  // Auto-fetch current price to pre-populate live data
  var liveNow = null;
  try{ liveNow = await fetchLiveData(ticker); }catch(e){}
  if(btn){ btn.disabled=false; btn.textContent=oldTxt; }

  let hd=null;
  try{const p=JSON.parse(localStorage.getItem('ss_pending'));if(p&&p.company_name===name)hd=p;}catch(e){}

  var divAnnual = liveNow?.divRate || hd?.dividend_annual || 0;
  var divYield  = liveNow?.divYield || hd?.dividend_yield || 0;

  port.push({
    company_name:name, ticker_yahoo:ticker, ticker_display:ticker,
    buy_price:buy, qty:qty,
    date:dt||new Date().toISOString().split('T')[0],
    total_score:hd?.total_score||null, max_score:hd?.max_score||null,
    verdict:hd?.verdict||null, type:hd?.type||null,
    sector: sectorInput || hd?.sector || 'Autre',
    upside_12m:hd?.upside_12m||null,
    dividend_annual:divAnnual,
    dividend_yield:divYield,
    dividend_note:hd?.dividend_note||'',
    // Store current price at time of add for reference
    price_at_add: liveNow?.price || null,
    currency_at_add: liveNow?.currency || '',
    added_at:new Date().toLocaleDateString('fr-FR')
  });
  save('ss_port',port);
  localStorage.removeItem('ss_pending');
  ['pf-name','pf-ticker','pf-buy','pf-qty','pf-date'].forEach(id=>document.getElementById(id).value='');
  document.getElementById('pf-sector').value='';
  if(liveNow) showToast('Position ajoutee · Cours actuel : '+liveNow.price.toFixed(2)+' '+liveNow.currency, 'success');
  else showToast('Position ajoutee (cours non recupere — verifie le ticker)', 'success');
  updateCounts();updateDataSummary();renderPort();
}

function saveCardEdit(name){
  var idx = port.findIndex(function(p){ return p.company_name === name; });
  if(idx === -1) return;
  var safeId = 'p' + idx;
  var buyInp    = document.getElementById('edit-buy-'+safeId);
  var qtyInp    = document.getElementById('edit-qty-'+safeId);
  var tickerInp = document.getElementById('edit-ticker-'+safeId);
  if(buyInp && buyInp.value)    port[idx].buy_price    = parseFloat(buyInp.value);
  if(qtyInp && qtyInp.value)    port[idx].qty          = parseInt(qtyInp.value);
  if(tickerInp && tickerInp.value) port[idx].ticker_yahoo = tickerInp.value.trim();
  save('ss_port', port);
  showToast('Position mise a jour !', 'success');
  renderPort();
}


function removePort(name){port=port.filter(p=>p.company_name!==name);save('ss_port',port);updateCounts();updateDataSummary();renderPort();}

async function renderPort(){
  updateCounts();
  const empty=document.getElementById('port-empty'),content=document.getElementById('port-content'),grid=document.getElementById('port-grid'),sumbar=document.getElementById('port-sumbar');
  if(!port.length){empty.style.display='block';content.style.display='none';return;}
  empty.style.display='none';content.style.display='block';
  grid.innerHTML='';

  // Fetch live prices for all positions
  const liveMap={};
  await Promise.all(port.map(async p=>{
    if(p.ticker_yahoo){liveMap[p.company_name]=await fetchLiveData(p.ticker_yahoo);}
  }));

  // Summary stats — only count positions with BOTH buy price AND live price
  let totalInvested=0, totalCurrentVal=0, positionsWithPrice=0, positionsMissingPrice=0;
  port.forEach(function(p){
    var live=liveMap[p.company_name];
    if(p.buy_price && p.qty){
      totalInvested += p.buy_price * p.qty;
      if(live && live.price){ totalCurrentVal += live.price * p.qty; positionsWithPrice++; }
      else positionsMissingPrice++;
    } else { positionsMissingPrice++; }
  });
  var partialPriced = positionsWithPrice > 0 && positionsMissingPrice > 0;
  var totalPnl = positionsWithPrice > 0 ? totalCurrentVal - totalInvested : null;
  var totalPnlPct = totalInvested > 0 && totalPnl !== null ? (totalPnl/totalInvested*100) : null;

  var missingHtml = partialPriced
    ? '<div style="grid-column:1/-1;font-size:11px;color:var(--amber);font-weight:600;padding:4px 0;border-top:1px solid var(--border);margin-top:4px;">Attention : '+positionsMissingPrice+' position(s) sans cours — P&L partiel ('+positionsWithPrice+'/'+port.length+' valeurs). Verifiez les tickers.</div>'
    : (positionsMissingPrice > 0 && positionsWithPrice === 0)
    ? '<div style="grid-column:1/-1;font-size:11px;color:var(--muted);font-weight:600;padding:4px 0;">Aucun cours disponible — ajoutez les tickers Yahoo Finance pour calculer la plus-value.</div>'
    : '';

  var pnlCls = totalPnl>0?'pos':totalPnl<0?'neg':'neu';
  var pnlPctCls = totalPnlPct>0?'pos':totalPnlPct<0?'neg':'neu';
  sumbar.innerHTML =
    '<div><div class="psb-lbl">Positions</div><div class="psb-val neu">'+port.length
      +(positionsMissingPrice>0?' <span style="font-size:10px;color:var(--amber);">'+positionsMissingPrice+' sans cours</span>':'')+'</div></div>'
    +'<div><div class="psb-lbl">Investi total</div><div class="psb-val neu">'+(totalInvested>0?totalInvested.toLocaleString('fr-FR',{minimumFractionDigits:2,maximumFractionDigits:2})+' €':'--')+'</div></div>'
    +'<div><div class="psb-lbl">Plus-value'+(partialPriced?' (partielle)':'')+'</div><div class="psb-val '+pnlCls+'">'+(totalPnl!==null?(totalPnl>=0?'+':'')+totalPnl.toLocaleString('fr-FR',{minimumFractionDigits:2,maximumFractionDigits:2})+' €':'--')+'</div></div>'
    +'<div><div class="psb-lbl">P&L %</div><div class="psb-val '+pnlPctCls+'">'+(totalPnlPct!==null?(totalPnlPct>=0?'+':'')+totalPnlPct.toFixed(2)+'%':'--')+'</div></div>'
    + missingHtml;

  renderSectorChart();

  // Render each card
  port.forEach(p=>{
    const live=liveMap[p.company_name];
    const hasScore=p.total_score&&p.max_score;
    const ratio=hasScore?p.total_score/p.max_score:null;
    const col=ratio?(ratio>=.75?'#3B6D11':ratio>=.55?'#BA7517':'#A32D2D'):'var(--muted)';
    const invested=p.buy_price&&p.qty?p.buy_price*p.qty:null;
    const currentVal=live?.price&&p.qty?live.price*p.qty:null;
    const pnl=invested&&currentVal?currentVal-invested:null;
    const pnlPct=invested&&pnl!==null?pnl/invested*100:null;
    const card=document.createElement('div');card.className='port-card';

    // Missing data warning on card
    const missingBuyPrice = !p.buy_price || !p.qty;
    const missingTicker   = !p.ticker_yahoo;
    const missingWarn = missingBuyPrice
      ? '<div style="background:var(--amber-bg);border-radius:7px;padding:8px 11px;margin:8px 0;font-size:12px;color:var(--amber);">'
        + '<strong>Donnees manquantes</strong> — Ce titre est exclu des calculs P&L. '
        + 'Renseigne :<br>'
        + (!p.buy_price ? '<label style="display:flex;align-items:center;gap:6px;margin-top:5px;">Prix achat : <input type="number" step="0.01" placeholder="ex: 4.70" id="edit-buy-'+safeId+'" style="flex:1;height:28px;padding:0 8px;border:1px solid var(--amber);border-radius:5px;font-size:12px;background:var(--bg2);"></label>' : '')
        + (!p.qty ? '<label style="display:flex;align-items:center;gap:6px;margin-top:5px;">Nb actions : <input type="number" placeholder="ex: 100" id="edit-qty-'+safeId+'" style="flex:1;height:28px;padding:0 8px;border:1px solid var(--amber);border-radius:5px;font-size:12px;background:var(--bg2);"></label>' : '')
        + (!p.ticker_yahoo ? '<label style="display:flex;align-items:center;gap:6px;margin-top:5px;">Ticker Yahoo : <input type="text" placeholder="ex: ALMDT.PA" id="edit-ticker-'+safeId+'" style="flex:1;height:28px;padding:0 8px;border:1px solid var(--amber);border-radius:5px;font-size:12px;background:var(--bg2);font-family:monospace;"></label>' : '')
        + '<button onclick="saveCardEdit('+JSON.stringify(p.company_name)+')" style="margin-top:7px;padding:5px 14px;background:var(--amber);color:#fff;border:none;border-radius:6px;font-size:12px;font-weight:700;cursor:pointer;width:100%;">Enregistrer</button>'
        + '</div>'
      : '';

    // Live price block
    let liveBlock='';
    if(!p.ticker_yahoo){
      liveBlock='<div class="live-row" style="background:var(--red-bg);border-radius:6px;padding:4px 8px;">'
        +'<span style="font-size:11px;color:var(--red);font-weight:600;">Pas de ticker Yahoo Finance — prix et P&L impossibles. Edite la position pour ajouter le ticker.</span>'
        +'</div>';
    } else if(live){
      const chgCls=live.change>0?'pos':live.change<0?'neg':'neu';
      liveBlock=`<div class="live-row">
        <span class="live-price">${live.price.toFixed(2)} ${live.currency}</span>
        <span class="live-change ${chgCls}">${live.change>=0?'+':''}${live.change.toFixed(2)}%</span>
        ${live.marketTime?`<span class="live-time">Mise à jour ${live.marketTime}</span>`:''}
      </div>`;
    } else if(p.ticker_yahoo){
      liveBlock='<div class="live-row" style="background:var(--amber-bg);border-radius:6px;padding:4px 8px;">'
        +'<span style="font-size:11px;color:var(--amber);font-weight:600;">⚠ Cours non disponible — ticker: '+p.ticker_yahoo+' — verifiez le ticker Yahoo Finance</span>'
        +'</div>';
    }

    // Dividend block
    const divBlock=p.dividend_annual>0
      ? `<div class="div-row"><span class="div-badge">Dividende : ${p.dividend_annual.toFixed(2)} € / action · Rendement : ${p.dividend_yield.toFixed(2)}%</span></div>`
      : `<div class="div-row"><span class="div-badge none">Pas de dividende versé</span></div>`;

    // Build safe ID from index
    const safeId = 'p' + port.indexOf(p);
    card.innerHTML=
      '<button class="mini-del" data-action="del" data-safe="'+safeId+'">x</button>'
      +missingWarn
      +'<div class="port-name">'+p.company_name+'</div>'
      +'<div class="port-meta-row">'+(p.ticker_yahoo||p.ticker_display||'--')+' · '+(p.sector||'--')+'</div>'
      +liveBlock
      +'<div class="pstats">'
      +'<div class="pstat"><div class="pstat-lbl">Prix achat</div><div class="pstat-val neu">'+(p.buy_price?p.buy_price.toFixed(2)+' €':'--')+'</div></div>'
      +'<div class="pstat"><div class="pstat-lbl">Quantité</div><div class="pstat-val neu">'+(p.qty||'--')+'</div></div>'
      +'<div class="pstat"><div class="pstat-lbl">Investi</div><div class="pstat-val neu">'+(invested?invested.toLocaleString('fr-FR',{minimumFractionDigits:2,maximumFractionDigits:2})+' €':'--')+'</div></div>'
      +'<div class="pstat"><div class="pstat-lbl">Valeur actuelle</div><div class="pstat-val neu">'+(currentVal?currentVal.toLocaleString('fr-FR',{minimumFractionDigits:2,maximumFractionDigits:2})+' €':'--')+'</div></div>'
      +'<div class="pstat"><div class="pstat-lbl">Plus-value</div><div class="pstat-val '+(pnl>0?'pos':pnl<0?'neg':'neu')+'">'+(pnl!==null?(pnl>=0?'+':'')+pnl.toLocaleString('fr-FR',{minimumFractionDigits:2,maximumFractionDigits:2})+' €':'--')+'</div></div>'
      +'<div class="pstat"><div class="pstat-lbl">P&L %</div><div class="pstat-val '+(pnlPct>0?'pos':pnlPct<0?'neg':'neu')+'">'+(pnlPct!==null?(pnlPct>=0?'+':'')+pnlPct.toFixed(2)+'%':'--')+'</div></div>'
      +'</div>'
      +divBlock
      +(hasScore?'<div class="health-bar"><div class="health-lbl"><span>Santé IA : '+p.total_score+'/'+p.max_score+' · <span class="mini-verdict '+vc(p.verdict)+'">'+vl(p.verdict)+'</span></span><span>'+Math.round(ratio*100)+'%</span></div><div class="health-bg"><div class="health-fill" style="width:'+Math.round(ratio*100)+'%;background:'+col+'"></div></div></div>':'<div style="font-size:11px;color:var(--muted);margin:6px 0;">Lance une analyse pour obtenir le score de santé.</div>')
      +(p.upside_12m?'<div style="font-size:11px;margin:4px 0;color:'+(parseFloat(p.upside_12m)>0?'#3B6D11':'#A32D2D')+'">Potentiel 12 mois : <strong>'+p.upside_12m+'</strong></div>':'')
      +'<div class="mini-date">Acheté le '+(p.date||'--')+' · Ajouté le '+(p.added_at||'--')+(p.last_updated?' · <span style="color:#3B6D11;font-weight:600">Actualisé le '+p.last_updated+'</span>':'')+'</div>'
      +'<div id="port-status-'+safeId+'" style="display:none;font-size:11px;font-weight:600;padding:5px 9px;border-radius:6px;margin:6px 0;"></div>'
      +'<button class="mini-reanal" data-action="update" data-safe="'+safeId+'">Actualiser analyse</button>';

    // Store name on card element for event delegation
    card.dataset.name = p.company_name;
    card.dataset.safe = safeId;
    grid.appendChild(card);
  });
}

// -- REANALYZE -- robust, no tab switch, updates in place ------------------

// Shared worker: runs the AI analysis silently then calls back
async function runAnalysis(name, onSuccess, onFail){
  const ak=localStorage.getItem('groq_key')||'';
  if(!ak){ onFail('Clé API manquante'); return; }

  const prompt=buildPrompt(name, '');
  try{
    const raw=await groqFetch(ak,[
      {role:'system',content:'Tu es un assistant financier expert. Tu reponds UNIQUEMENT en JSON valide strict sans texte avant ou apres, sans markdown.'},
      {role:'user',content:prompt}
    ], 2800);
    const result={...parseGroqJSON(raw),analyzed_at:new Date().toLocaleDateString('fr-FR')};
    onSuccess(result);
  }catch(e){
    onFail(e.message);
  }
}

// Update a card in place using a status element ID
function setCardStatus(statusId, msg, type){
  const el=document.getElementById(statusId);
  if(!el)return;
  el.style.display='block';
  el.style.background=type==='ok'?'var(--green-bg)':type==='err'?'var(--red-bg)':'var(--amber-bg)';
  el.style.color=type==='ok'?'var(--green)':type==='err'?'var(--red)':'var(--amber)';
  el.textContent=msg;
  if(type==='ok'||type==='err') setTimeout(()=>{ if(el) el.style.display='none'; },4000);
}

// Called from Favoris tab
function reanalyzeFav(name, safeId){
  const statusId = safeId ? 'fav-status-'+safeId : null;
  const btnId = safeId ? 'fav-btn-'+safeId : null;
  const btn = btnId ? document.getElementById(btnId) : null;
  const statusEl = statusId ? document.getElementById(statusId) : null;
  if(btn){ btn.disabled=true; btn.textContent='Analyse en cours...'; }
  if(statusEl){ statusEl.style.display='block'; statusEl.style.background='var(--amber-bg)'; statusEl.style.color='var(--amber)'; statusEl.textContent='Analyse IA en cours, patiente ~15 sec...'; }

  runAnalysis(name,
    function(result){
      const idx=favs.findIndex(f=>f.company_name===name);
      if(idx>=0){
        favs[idx]={...favs[idx],...result};
        save('ss_favs',favs);
      }
      setCardStatus(statusId,'Mis à jour le '+new Date().toLocaleDateString('fr-FR')+' à '+new Date().toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'}),'ok');
      showToast('Favori "'+name+'" mis à jour !','success');
      renderFavs();
    },
    function(err){
      setCardStatus(statusId,'Échec : '+err,'err');
      if(btn){ btn.disabled=false; btn.textContent='Actualiser analyse ->'; }
      showToast('Échec pour "'+name+'"','error');
    }
  );
}

// Called from Portefeuille tab
function reanalyzePort(name, safeId){
  const statusId = safeId ? 'port-status-'+safeId : null;
  const btnId = safeId ? 'port-btn-'+safeId : null;
  const btn = btnId ? document.getElementById(btnId) : null;
  const statusEl = statusId ? document.getElementById(statusId) : null;
  if(btn){ btn.disabled=true; btn.textContent='Analyse en cours...'; }
  if(statusEl){ statusEl.style.display='block'; statusEl.style.background='var(--amber-bg)'; statusEl.style.color='var(--amber)'; statusEl.textContent='Analyse IA en cours, patiente ~15 sec...'; }

  runAnalysis(name,
    function(result){
      const idx=port.findIndex(p=>p.company_name===name);
      if(idx>=0){
        port[idx]={
          ...port[idx],
          total_score:result.total_score,
          max_score:result.max_score,
          verdict:result.verdict,
          type:result.type||port[idx].type,
          sector:result.sector||port[idx].sector,
          upside_12m:result.upside_12m||port[idx].upside_12m,
          dividend_annual:result.dividend_annual!=null?result.dividend_annual:port[idx].dividend_annual,
          dividend_yield:result.dividend_yield!=null?result.dividend_yield:port[idx].dividend_yield,
          dividend_note:result.dividend_note||port[idx].dividend_note,
          last_updated:new Date().toLocaleDateString('fr-FR')+' '+new Date().toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})
        };
        save('ss_port',port);
      }
      setCardStatus(statusId,'Mis à jour le '+new Date().toLocaleDateString('fr-FR')+' à '+new Date().toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'}),'ok');
      showToast('Position "'+name+'" mise à jour !','success');
      renderPort();
    },
    function(err){
      setCardStatus(statusId,'Échec : '+err,'err');
      if(btn){ btn.disabled=false; btn.textContent='Actualiser analyse ->'; }
      showToast('Échec pour "'+name+'"','error');
    }
  );
}

// Simple reanalyze from favs (switch to analyze tab)
function reanalyze(name){
  document.getElementById('cInput').value=name;
  switchTab('analyze');
  go(name, null);
}

// -- TOAST NOTIFICATION ----------------------------------------------------
function showToast(msg, type){
  let t=document.getElementById('toast');
  if(!t){
    t=document.createElement('div');
    t.id='toast';
    t.style.cssText='position:fixed;bottom:24px;left:50%;transform:translateX(-50%);padding:10px 20px;border-radius:8px;font-size:13px;font-weight:600;z-index:9999;transition:opacity .3s;pointer-events:none;';
    document.body.appendChild(t);
  }
  t.style.background=type==='success'?'#3B6D11':'#A32D2D';
  t.style.color='#fff';
  t.textContent=msg;
  t.style.opacity='1';
  clearTimeout(t._timer);
  t._timer=setTimeout(()=>{ t.style.opacity='0'; },3000);
}


// -- AUTOCOMPLETE DATABASE -------------------------------------------------
// Curated list: [name, ticker, market, sector, type, country]
const AC_DB = [
  // ======= CAC 40 =======
  ["Air Liquide","AI.PA","Euronext","Gaz industriels","sc","FR"],
  ["Airbus","AIR.PA","Euronext","Aeronautique","sc","FR"],
  ["ArcelorMittal","MT.AS","Euronext Amsterdam","Siderurgie","sc","LU"],
  ["AXA","CS.PA","Euronext","Assurance","sc","FR"],
  ["BNP Paribas","BNP.PA","Euronext","Banque","sc","FR"],
  ["Bouygues","EN.PA","Euronext","BTP telecoms","sc","FR"],
  ["Capgemini","CAP.PA","Euronext","IT services","sc","FR"],
  ["Saint-Gobain","SGO.PA","Euronext","Materiaux construction","sc","FR"],
  ["Michelin","ML.PA","Euronext","Pneumatiques","sc","FR"],
  ["Credit Agricole","ACA.PA","Euronext","Banque","sc","FR"],
  ["Danone","BN.PA","Euronext","Agroalimentaire","sc","FR"],
  ["Dassault Systemes","DSY.PA","Euronext","Logiciels 3D","sc","FR"],
  ["Engie","ENGI.PA","Euronext","Energie utilities","sc","FR"],
  ["EssilorLuxottica","EL.PA","Euronext","Optique","sc","FR"],
  ["Eurofins Scientific","ERF.PA","Euronext","Laboratoires","sc","LU"],
  ["Hermes International","RMS.PA","Euronext","Luxe","sc","FR"],
  ["Kering","KER.PA","Euronext","Luxe","sc","FR"],
  ["Legrand","LR.PA","Euronext","Electricite batiment","sc","FR"],
  ["LOreal","OR.PA","Euronext","Cosmetiques","sc","FR"],
  ["LVMH","MC.PA","Euronext","Luxe","sc","FR"],
  ["Orange","ORA.PA","Euronext","Telecoms","sc","FR"],
  ["Pernod Ricard","RI.PA","Euronext","Spiritueux","sc","FR"],
  ["Publicis","PUB.PA","Euronext","Communication","sc","FR"],
  ["Renault","RNO.PA","Euronext","Automobile","sc","FR"],
  ["Safran","SAF.PA","Euronext","Aeronautique defense","sc","FR"],
  ["Sanofi","SAN.PA","Euronext","Pharma","bio","FR"],
  ["Schneider Electric","SU.PA","Euronext","Energie automatisation","sc","FR"],
  ["Societe Generale","GLE.PA","Euronext","Banque","sc","FR"],
  ["Stellantis","STLAM.MI","Euronext","Automobile","sc","NL"],
  ["STMicroelectronics","STMPA.PA","Euronext","Semi-conducteurs","sc","NL"],
  ["Teleperformance","TEP.PA","Euronext","Services clients","sc","FR"],
  ["Thales","HO.PA","Euronext","Defense electronique","sc","FR"],
  ["TotalEnergies","TTE.PA","Euronext","Energie","sc","FR"],
  ["Unibail-Rodamco-Westfield","URW.AS","Euronext Amsterdam","Immobilier commercial","sc","FR"],
  ["Veolia","VIE.PA","Euronext","Environnement","sc","FR"],
  ["Vinci","DG.PA","Euronext","Construction concessions","sc","FR"],
  ["Vivendi","VIV.PA","Euronext","Medias","sc","FR"],
  ["Worldline","WLN.PA","Euronext","Paiements","sc","FR"],
  // ======= CAC NEXT 20 / SBF 120 =======
  ["Accor","AC.PA","Euronext","Hotellerie","sc","FR"],
  ["Alstom","ALO.PA","Euronext","Transport ferroviaire","sc","FR"],
  ["Amundi","AMUN.PA","Euronext","Gestion actifs","sc","FR"],
  ["Arkema","AKE.PA","Euronext","Chimie specialite","sc","FR"],
  ["Atos","ATO.PA","Euronext","IT services","sc","FR"],
  ["Biomerieux","BIM.PA","Euronext","Diagnostics in vitro","bio","FR"],
  ["Bureau Veritas","BVI.PA","Euronext","Certification tests","sc","FR"],
  ["Carrefour","CA.PA","Euronext","Distribution alimentaire","sc","FR"],
  ["Coface","COFA.PA","Euronext","Assurance credit","sc","FR"],
  ["Covivio","COV.PA","Euronext","Immobilier bureau","sc","FR"],
  ["Edenred","EDEN.PA","Euronext","Services prepaye","sc","FR"],
  ["EDF","EDF.PA","Euronext","Electricite","sc","FR"],
  ["Elis","ELIS.PA","Euronext","Services textiles","sc","FR"],
  ["Eurazeo","RF.PA","Euronext","Private equity","sc","FR"],
  ["Eutelsat","ETL.PA","Euronext","Satellites","sc","FR"],
  ["Faurecia","EO.PA","Euronext","Equipements auto","sc","FR"],
  ["Gecina","GFC.PA","Euronext","Immobilier bureau","sc","FR"],
  ["GTT","GTT.PA","Euronext","Technologies GNL","sc","FR"],
  ["Icade","ICAD.PA","Euronext","Immobilier","sc","FR"],
  ["Imerys","NK.PA","Euronext","Mineraux industriels","sc","FR"],
  ["Ipsen","IPN.PA","Euronext","Pharma specialite","bio","FR"],
  ["JCDecaux","DEC.PA","Euronext","Affichage publicitaire","sc","FR"],
  ["Klepierre","LI.PA","Euronext","Centres commerciaux","sc","FR"],
  ["La Francaise des Jeux","FDJ.PA","Euronext","Jeux loterie","sc","FR"],
  ["Lagardere","MMB.PA","Euronext","Medias voyage","sc","FR"],
  ["Nexans","NEX.PA","Euronext","Cables electriques","sc","FR"],
  ["Nexity","NXI.PA","Euronext","Promotion immobiliere","sc","FR"],
  ["OVH Groupe","OVH.PA","Euronext","Cloud hosting","sc","FR"],
  ["Plastic Omnium","POM.PA","Euronext","Equipements auto","sc","FR"],
  ["Remy Cointreau","RCO.PA","Euronext","Spiritueux","sc","FR"],
  ["Rexel","RXL.PA","Euronext","Distribution electrique","sc","FR"],
  ["Rubis","RUI.PA","Euronext","Energie distribution","sc","FR"],
  ["Sartorius Stedim Biotech","DIM.PA","Euronext","Biotech equipements","bio","FR"],
  ["SEB","SK.PA","Euronext","Electromenager","sc","FR"],
  ["Soitec","SOI.PA","Euronext","Semi-conducteurs","sc","FR"],
  ["Sopra Steria","SOP.PA","Euronext","IT conseil","sc","FR"],
  ["Spie","SPIE.PA","Euronext","Services techniques","sc","FR"],
  ["Technip Energies","TE.PA","Euronext","Ingenierie energie","sc","FR"],
  ["Tikehau Capital","TKO.PA","Euronext","Private equity","sc","FR"],
  ["Ubisoft","UBI.PA","Euronext","Jeux video","sc","FR"],
  ["Valeo","FR.PA","Euronext","Equipements auto","sc","FR"],
  ["Vallourec","VK.PA","Euronext","Tubes acier","sc","FR"],
  ["Verallia","VRLA.PA","Euronext","Emballages verre","sc","FR"],
  ["Wendel","MF.PA","Euronext","Holding investissement","sc","FR"],
  // ======= CAC MID & SMALL =======
  ["Aeroports de Paris","ADP.PA","Euronext","Aeroports","sc","FR"],
  ["Albioma","ABIO.PA","Euronext","Energies renouvelables","sc","FR"],
  ["Alten","ATE.PA","Euronext","Ingenierie IT","sc","FR"],
  ["Argan","ARG.PA","Euronext","SIIC logistique","sc","FR"],
  ["Assystem","ASY.PA","Euronext","Ingenierie nucleaire","sc","FR"],
  ["Aubay","AUB.PA","Euronext","IT services","sc","FR"],
  ["Axway Software","AXW.PA","Euronext","Logiciels API","sc","FR"],
  ["Beneteau","BEN.PA","Euronext","Construction nautique","sc","FR"],
  ["Bigben Interactive","BIG.PA","Euronext","Gaming accessoires","sc","FR"],
  ["Bonduelle","BON.PA","Euronext","Legumes conserves","sc","FR"],
  ["Boiron","BOI.PA","Euronext","Homeopathie","bio","FR"],
  ["Chargeurs","CRI.PA","Euronext","Produits techniques","sc","FR"],
  ["Compagnie des Alpes","CDA.PA","Euronext","Tourisme montagne","sc","FR"],
  ["Delta Plus Group","DLTA.PA","Euronext","EPI securite","sc","FR"],
  ["Devoteam","DVTM.PA","Euronext","IT conseil cloud","sc","FR"],
  ["Dior","CDI.PA","Euronext","Luxe","sc","FR"],
  ["Eiffage","FGR.PA","Euronext","Construction","sc","FR"],
  ["Elior Group","ELIOR.PA","Euronext","Restauration collective","sc","FR"],
  ["Esker","ESK.PA","Euronext","Dematerialisation docs","sc","FR"],
  ["Esso","ES.PA","Euronext","Raffinage petrole","sc","FR"],
  ["Euronext","ENX.PA","Euronext","Marches financiers","sc","FR"],
  ["Exacompta","EXAC.PA","Euronext","Papeterie","sc","FR"],
  ["Exel Industries","EXE.PA","Euronext","Machines agricoles","sc","FR"],
  ["Fleury Michon","FM.PA","Euronext","Charcuterie","sc","FR"],
  ["Fnac Darty","FNAC.PA","Euronext","Retail electronique","sc","FR"],
  ["Fromageries Bel","FBEL.PA","Euronext","Fromages","sc","FR"],
  ["GL Events","GLO.PA","Euronext","Evenementiel","sc","FR"],
  ["Guerbet","GBT.PA","Euronext","Produits contraste imagerie","bio","FR"],
  ["Haulotte Group","HGO.PA","Euronext","Plates-formes elevat.","sc","FR"],
  ["HEXAOM","HEXA.PA","Euronext","Maisons individuelles","sc","FR"],
  ["ID Logistics","IDL.PA","Euronext","Logistique","sc","FR"],
  ["Iliad","ILD.PA","Euronext","Telecoms","sc","FR"],
  ["Infotel","INF.PA","Euronext","IT services","sc","FR"],
  ["Interparfums","ITP.PA","Euronext","Parfums","sc","FR"],
  ["Jacquet Metals","JCQ.PA","Euronext","Distribution acier","sc","FR"],
  ["Kaufman Broad","KOF.PA","Euronext","Promotion immobiliere","sc","FR"],
  ["Lacroix","LACR.PA","Euronext","Electronique industriel","sc","FR"],
  ["Laurent-Perrier","LPE.PA","Euronext","Champagne","sc","FR"],
  ["Lectra","LSS.PA","Euronext","Logiciels industrie","sc","FR"],
  ["Linedata","LIN.PA","Euronext","Logiciels finance","sc","FR"],
  ["LISI","FII.PA","Euronext","Assemblage aero auto","sc","FR"],
  ["LNA Sante","LNA.PA","Euronext","Cliniques medicales","bio","FR"],
  ["Lumibird","LBIRD.PA","Euronext","Lasers","sc","FR"],
  ["Maisons du Monde","MDM.PA","Euronext","Ameublement deco","sc","FR"],
  ["Manitou","MTU.PA","Euronext","Engins manutention","sc","FR"],
  ["Manutan","MAN.PA","Euronext","Distribution B2B","sc","FR"],
  ["Mercialys","MERY.PA","Euronext","Centres commerciaux","sc","FR"],
  ["Mersen","MRN.PA","Euronext","Materiaux specialises","sc","FR"],
  ["Montupet","MTP.PA","Euronext","Fonderie aluminium","sc","FR"],
  ["NRJ Group","NRJ.PA","Euronext","Medias radio TV","sc","FR"],
  ["Oeneo","SABT.PA","Euronext","Bouchons vin","sc","FR"],
  ["Orapi","ORAP.PA","Euronext","Produits hygiene","sc","FR"],
  ["Parrot","PARRO.PA","Euronext Growth","Drones","sc","FR"],
  ["Peugeot Invest","PEUG.PA","Euronext","Holding","sc","FR"],
  ["Pierre et Vacances","VAC.PA","Euronext","Tourisme residences","sc","FR"],
  ["Poujoulat","ALPJT.PA","Euronext Growth","Conduits cheminees","sc","FR"],
  ["Precia","PREC.PA","Euronext","Pesage industriel","sc","FR"],
  ["Prodways","PWG.PA","Euronext","Impression 3D","sc","FR"],
  ["Robertet","RBT.PA","Euronext","Aromes parfums","sc","FR"],
  ["Samse","SAMS.PA","Euronext","Distribution materiaux","sc","FR"],
  ["Savencia","SAVE.PA","Euronext","Produits laitiers","sc","FR"],
  ["SES-imagotag","SESL.PA","Euronext","Etiquettes electroniques","sc","FR"],
  ["SII","SII.PA","Euronext","Ingenierie logicielle","sc","FR"],
  ["Societe BIC","BB.PA","Euronext","Papeterie grand public","sc","FR"],
  ["Solutions 30","S30.PA","Euronext","Services techniques","sc","FR"],
  ["Somfy","SO.PA","Euronext","Automatismes batiment","sc","FR"],
  ["Sopra Banking","SBK.PA","Euronext","Logiciels bancaires","sc","FR"],
  ["SQLI","SQI.PA","Euronext","Conseil digital","sc","FR"],
  ["Stef","STF.PA","Euronext","Transport froid","sc","FR"],
  ["Sword Group","SWP.PA","Euronext","IT services","sc","FR"],
  ["Synergie","SDG.PA","Euronext","Interim emploi","sc","FR"],
  ["Tessi","TSI.PA","Euronext","Gestion documents","sc","FR"],
  ["Thermador Groupe","THEP.PA","Euronext","Distribution industrielle","sc","FR"],
  ["Trigano","TRI.PA","Euronext","Camping-cars","sc","FR"],
  ["Verimatrix","VMX.PA","Euronext","Cybersecurite","sc","FR"],
  ["Vicat","VCT.PA","Euronext","Ciment","sc","FR"],
  ["Virbac","VIRP.PA","Euronext","Sante animale","bio","FR"],
  ["Vetoquinol","VETO.PA","Euronext","Sante animale","bio","FR"],
  // ======= EURONEXT GROWTH FR =======
  ["Abivax","ABVX.PA","Euronext Growth","Biotech virologie","bio","FR"],
  ["Adocia","ADOC.PA","Euronext","Biotech diabete","bio","FR"],
  ["Advicenne","ALAD.PA","Euronext Growth","Biotech renale","bio","FR"],
  ["Alan Allman Associates","AAA.PA","Euronext Growth","Conseil management","sc","FR"],
  ["Amoeba","ALMBO.PA","Euronext Growth","Biotech environnement","bio","FR"],
  ["Amplitude Surgical","AMPLI.PA","Euronext","Medtech orthopedie","bio","FR"],
  ["Aquila AM","AQULA.PA","Euronext Growth","Gestion actifs","sc","FR"],
  ["Biophytis","ALBPS.PA","Euronext Growth","Biotech vieillissement","bio","FR"],
  ["Catana Group","CATG.PA","Euronext Growth","Catamarans","sc","FR"],
  ["Cegedim","CGM.PA","Euronext","Logiciels sante","sc","FR"],
  ["Cellectis","ALCLS.PA","Euronext Growth","Biotech therapie genique","bio","FR"],
  ["Coheris","COH.PA","Euronext","CRM Analytics","sc","FR"],
  ["Crossject","ALCJ.PA","Euronext Growth","Drug delivery","bio","FR"],
  ["DBV Technologies","DBV.PA","Euronext","Biotech allergie","bio","FR"],
  ["Easyvista","ALEVY.PA","Euronext Growth","Logiciels ITSM","sc","FR"],
  ["Erytech Pharma","ERYP.PA","Euronext","Biotech oncologie","bio","FR"],
  ["Eurobio Scientific","ALERS.PA","Euronext Growth","Diagnostics","bio","FR"],
  ["Fountaine Pajot","ALFTP.PA","Euronext Growth","Catamarans luxe","sc","FR"],
  ["Gaussin","ALGAU.PA","Euronext Growth","Vehicules autonomes","sc","FR"],
  ["Generix","GNRX.PA","Euronext Growth","Logiciels supply chain","sc","FR"],
  ["Genfit","GNFT.PA","Euronext","Biotech hepatologie","bio","FR"],
  ["Groupe Guillin","ALGIL.PA","Euronext Growth","Emballages plastique","sc","FR"],
  ["Groupe Open","OPN.PA","Euronext","IT services","sc","FR"],
  ["HalioDx","ALHAD.PA","Euronext Growth","Diagnostics oncologie","bio","FR"],
  ["Hydrogen Refueling","ALHRS.PA","Euronext Growth","Hydrogene","sc","FR"],
  ["Innate Pharma","IPH.PA","Euronext","Biotech immuno-oncologie","bio","FR"],
  ["Inotrem","ALINO.PA","Euronext Growth","Biotech inflammation","bio","FR"],
  ["Inventiva","IVA.PA","Euronext Growth","Biotech maladies rares","bio","FR"],
  ["IEVA Group","IEVA.PA","Euronext Growth","Beauty tech","sc","FR"],
  ["Louis Hachette Group","ALHAC.PA","Euronext Growth","Medias edition","sc","FR"],
  ["Lunalogic","ALLUN.PA","Euronext Growth","IT","sc","FR"],
  ["Lysogene","LYS.PA","Euronext Growth","Biotech maladies rares","bio","FR"],
  ["Median Technologies","ALMDT.PA","Euronext Growth","Medtech IA poumon","bio","FR"],
  ["Medincell","MEDCL.PA","Euronext","Drug delivery","bio","FR"],
  ["MGI Digital","ALMGI.PA","Euronext Growth","Imprimerie numerique","sc","FR"],
  ["Nanobiotix","NANO.PA","Euronext","Medtech radio-oncologie","bio","FR"],
  ["Neovacs","ALNEV.PA","Euronext Growth","Biotech auto-immunite","bio","FR"],
  ["Obiz","ALOB.PA","Euronext Growth","Avantages salaries","sc","FR"],
  ["Oncodesign Services","ALONC.PA","Euronext Growth","Biotech oncologie","bio","FR"],
  ["OSE Immunotherapeutics","OSE.PA","Euronext","Biotech immunologie","bio","FR"],
  ["Poxel","POXEL.PA","Euronext Growth","Biotech diabete","bio","FR"],
  ["Quantum Genomics","ALQGC.PA","Euronext Growth","Biotech cardiovasculaire","bio","FR"],
  ["Reworld Media","ALREW.PA","Euronext Growth","Medias digitaux","sc","FR"],
  ["Roctool","ALROC.PA","Euronext Growth","Industriel composite","sc","FR"],
  ["Sensorion","ALSEN.PA","Euronext Growth","Biotech ORL","bio","FR"],
  ["Sidetrade","ALBFR.PA","Euronext Growth","Logiciels IA finance","sc","FR"],
  ["SoLocal Group","LOCAL.PA","Euronext","Marketing digital","sc","FR"],
  ["Theranexus","ALTHX.PA","Euronext Growth","Biotech neurologie","bio","FR"],
  ["TME Pharma","ALTME.PA","Euronext Growth","Biotech oncologie","bio","FR"],
  ["Tonner Drones","ALTD.PA","Euronext Growth","Drones defense","sc","FR"],
  ["Transgene","TNG.PA","Euronext","Biotech immunotherapie","bio","FR"],
  ["Valbiotis","ALVAL.PA","Euronext Growth","Biotech nutrition","bio","FR"],
  ["Voluntis","ALVTX.PA","Euronext Growth","Digital therapeutics","bio","FR"],
  // ======= EUROPE =======
  ["ASML","ASML.AS","Euronext Amsterdam","Semi-conducteurs lithographie","sc","NL"],
  ["ABN AMRO","ABN.AS","Euronext Amsterdam","Banque","sc","NL"],
  ["Adyen","ADYEN.AS","Euronext Amsterdam","Paiements","sc","NL"],
  ["Aegon","AGN.AS","Euronext Amsterdam","Assurance","sc","NL"],
  ["Ahold Delhaize","AD.AS","Euronext Amsterdam","Distribution alimentaire","sc","NL"],
  ["Akzo Nobel","AKZA.AS","Euronext Amsterdam","Peintures","sc","NL"],
  ["Allianz","ALV.DE","XETRA","Assurance","sc","DE"],
  ["argenx","ARGX.AS","Euronext Amsterdam","Biotech immunologie","bio","BE"],
  ["BASF","BAS.DE","XETRA","Chimie","sc","DE"],
  ["Bayer","BAYN.DE","XETRA","Pharma chimie","bio","DE"],
  ["BMW","BMW.DE","XETRA","Automobile","sc","DE"],
  ["Continental","CON.DE","XETRA","Equipements auto","sc","DE"],
  ["CRH","CRH.IR","Euronext Dublin","Materiaux construction","sc","IE"],
  ["Daimler Truck","DTG.DE","XETRA","Camions","sc","DE"],
  ["Deutsche Bank","DBK.DE","XETRA","Banque","sc","DE"],
  ["Deutsche Post DHL","DHL.DE","XETRA","Logistique","sc","DE"],
  ["Deutsche Telekom","DTE.DE","XETRA","Telecoms","sc","DE"],
  ["E.ON","EOAN.DE","XETRA","Electricite gaz","sc","DE"],
  ["Eni","ENI.MI","Borsa Italiana","Energie petrole","sc","IT"],
  ["Enel","ENEL.MI","Borsa Italiana","Electricite","sc","IT"],
  ["Ferrari","RACE.MI","Borsa Italiana","Automobile luxe","sc","IT"],
  ["Fresenius","FRE.DE","XETRA","Sante dialyse","bio","DE"],
  ["Galapagos","GLPG.AS","Euronext Amsterdam","Biotech","bio","BE"],
  ["Genmab","GMAB.CO","Nasdaq Copenhagen","Biotech anticorps","bio","DK"],
  ["Heineken","HEIA.AS","Euronext Amsterdam","Biere","sc","NL"],
  ["Iberdrola","IBE.MC","Bolsa Madrid","Electricite renouvelable","sc","ES"],
  ["ING Group","INGA.AS","Euronext Amsterdam","Banque","sc","NL"],
  ["Intesa Sanpaolo","ISP.MI","Borsa Italiana","Banque","sc","IT"],
  ["Kone","KNEBV.HE","Helsinki","Ascenseurs","sc","FI"],
  ["Logitech","LOGN.SW","SIX","Peripheriques PC","sc","CH"],
  ["Lonza","LONN.SW","SIX","CDMO pharma","bio","CH"],
  ["Mercedes-Benz","MBG.DE","XETRA","Automobile","sc","DE"],
  ["Merck KGaA","MRK.DE","XETRA","Pharma chimie","bio","DE"],
  ["Moncler","MONC.MI","Borsa Italiana","Mode luxe","sc","IT"],
  ["MorphoSys","MOR.DE","XETRA","Biotech anticorps","bio","DE"],
  ["Muenchener Rueck","MUV2.DE","XETRA","Reassurance","sc","DE"],
  ["Nestle","NESN.SW","SIX","Agroalimentaire","sc","CH"],
  ["Nokia","NOKIA.HE","Helsinki","Telecoms equipements","sc","FI"],
  ["Novartis","NOVN.SW","SIX","Pharma","bio","CH"],
  ["Novo Nordisk","NOVO-B.CO","Nasdaq Copenhagen","Pharma diabete obesite","bio","DK"],
  ["NXP Semiconductors","NXPI","NASDAQ","Semi-conducteurs","sc","NL"],
  ["Philips","PHIA.AS","Euronext Amsterdam","Medtech electronique","bio","NL"],
  ["RELX","REL.L","LSE","Information analytique","sc","GB"],
  ["Roche","ROG.SW","SIX","Pharma diagnostics","bio","CH"],
  ["Ryanair","RYA.IR","Euronext Dublin","Transport aerien","sc","IE"],
  ["SAP","SAP.DE","XETRA","Logiciels ERP","sc","DE"],
  ["Siemens","SIE.DE","XETRA","Industrie electronique","sc","DE"],
  ["Siemens Energy","ENR.DE","XETRA","Energie transition","sc","DE"],
  ["Siemens Healthineers","SHL.DE","XETRA","Medtech imagerie","bio","DE"],
  ["Swiss Re","SREN.SW","SIX","Reassurance","sc","CH"],
  ["Telecom Italia","TIT.MI","Borsa Italiana","Telecoms","sc","IT"],
  ["UniCredit","UCG.MI","Borsa Italiana","Banque","sc","IT"],
  ["Volkswagen","VOW3.DE","XETRA","Automobile","sc","DE"],
  ["Wolters Kluwer","WKL.AS","Euronext Amsterdam","Information professionnelle","sc","NL"],
  ["Zurich Insurance","ZURN.SW","SIX","Assurance","sc","CH"],
  ["Evotec","EVO.DE","XETRA","Biotech services","bio","DE"],
  ["Qiagen","QGEN.DE","XETRA","Diagnostics moleculaires","bio","DE"],
  ["Idorsia","IDIA.SW","SIX","Biotech CNS","bio","CH"],
  ["Bavarian Nordic","BAVA.CO","Nasdaq Copenhagen","Biotech vaccins","bio","DK"],
  // ======= US MEGA CAPS =======
  ["Apple","AAPL","NASDAQ","Tech hardware","sc","US"],
  ["Microsoft","MSFT","NASDAQ","Logiciels cloud","sc","US"],
  ["Alphabet","GOOGL","NASDAQ","Tech publicite","sc","US"],
  ["Amazon","AMZN","NASDAQ","E-commerce cloud","sc","US"],
  ["Meta","META","NASDAQ","Reseaux sociaux","sc","US"],
  ["NVIDIA","NVDA","NASDAQ","Semi-conducteurs IA","sc","US"],
  ["Tesla","TSLA","NASDAQ","Vehicules electriques","sc","US"],
  ["Berkshire Hathaway","BRK-B","NYSE","Conglomerat","sc","US"],
  ["JPMorgan Chase","JPM","NYSE","Banque","sc","US"],
  ["Visa","V","NYSE","Paiements","sc","US"],
  ["Mastercard","MA","NYSE","Paiements","sc","US"],
  ["UnitedHealth","UNH","NYSE","Assurance sante","bio","US"],
  ["Johnson & Johnson","JNJ","NYSE","Pharma medtech","bio","US"],
  ["Eli Lilly","LLY","NYSE","Pharma diabete obesite","bio","US"],
  ["AbbVie","ABBV","NYSE","Pharma immunologie","bio","US"],
  ["Pfizer","PFE","NYSE","Pharma","bio","US"],
  ["Merck","MRK","NYSE","Pharma oncologie","bio","US"],
  ["Bristol Myers Squibb","BMY","NYSE","Pharma oncologie","bio","US"],
  ["Amgen","AMGN","NASDAQ","Biotech","bio","US"],
  ["Gilead Sciences","GILD","NASDAQ","Biotech antiviral","bio","US"],
  ["Regeneron","REGN","NASDAQ","Biotech","bio","US"],
  ["Biogen","BIIB","NASDAQ","Biotech neurologie","bio","US"],
  ["Moderna","MRNA","NASDAQ","Biotech ARNm","bio","US"],
  ["BioNTech","BNTX","NASDAQ","Biotech ARNm","bio","DE"],
  ["Vertex Pharmaceuticals","VRTX","NASDAQ","Biotech mucoviscidose","bio","US"],
  ["Intuitive Surgical","ISRG","NASDAQ","Medtech robotique","bio","US"],
  ["Abbott Laboratories","ABT","NYSE","Medtech diagnostics","bio","US"],
  ["Medtronic","MDT","NYSE","Medtech","bio","IE"],
  ["Stryker","SYK","NYSE","Medtech orthopedie","bio","US"],
  ["Boston Scientific","BSX","NYSE","Medtech cardiologie","bio","US"],
  ["Edwards Lifesciences","EW","NYSE","Medtech cardiaque","bio","US"],
  ["Becton Dickinson","BDX","NYSE","Medtech diagnostics","bio","US"],
  ["Danaher","DHR","NYSE","Medtech sciences vie","bio","US"],
  ["Thermo Fisher","TMO","NYSE","Sciences vie","bio","US"],
  ["Palantir","PLTR","NYSE","Data analytics IA","sc","US"],
  ["Snowflake","SNOW","NYSE","Data cloud","sc","US"],
  ["CrowdStrike","CRWD","NASDAQ","Cybersecurite","sc","US"],
  ["Palo Alto Networks","PANW","NASDAQ","Cybersecurite","sc","US"],
  ["ServiceNow","NOW","NYSE","Logiciels cloud","sc","US"],
  ["Salesforce","CRM","NYSE","CRM cloud","sc","US"],
  ["Adobe","ADBE","NASDAQ","Logiciels creatifs","sc","US"],
  ["Oracle","ORCL","NYSE","Logiciels base donnees","sc","US"],
  ["Cisco","CSCO","NASDAQ","Reseaux telecoms","sc","US"],
  ["Intel","INTC","NASDAQ","Semi-conducteurs","sc","US"],
  ["AMD","AMD","NASDAQ","Semi-conducteurs","sc","US"],
  ["Qualcomm","QCOM","NASDAQ","Semi-conducteurs mobile","sc","US"],
  ["Texas Instruments","TXN","NASDAQ","Semi-conducteurs","sc","US"],
  ["Applied Materials","AMAT","NASDAQ","Equipements semico","sc","US"],
  ["Lam Research","LRCX","NASDAQ","Equipements semico","sc","US"],
  ["TSMC","TSM","NYSE","Fonderie semico","sc","TW"],
  ["Netflix","NFLX","NASDAQ","Streaming video","sc","US"],
  ["Spotify","SPOT","NYSE","Streaming audio","sc","SE"],
  ["Uber","UBER","NYSE","Mobilite plateforme","sc","US"],
  ["Airbnb","ABNB","NASDAQ","Location saisonniere","sc","US"],
  ["Block","SQ","NYSE","Paiements fintech","sc","US"],
  ["PayPal","PYPL","NASDAQ","Paiements","sc","US"],
  ["Coinbase","COIN","NASDAQ","Cryptomonnaies exchange","sc","US"],
  ["Caterpillar","CAT","NYSE","Engins chantier","sc","US"],
  ["Deere","DE","NYSE","Machines agricoles","sc","US"],
  ["Boeing","BA","NYSE","Aeronautique","sc","US"],
  ["Lockheed Martin","LMT","NYSE","Defense","sc","US"],
  ["Raytheon","RTX","NYSE","Defense aerospatiale","sc","US"],
  ["ExxonMobil","XOM","NYSE","Energie petrole","sc","US"],
  ["Chevron","CVX","NYSE","Energie petrole","sc","US"],
  ["NextEra Energy","NEE","NYSE","Electricite renouvelable","sc","US"],
  ["Walmart","WMT","NYSE","Distribution","sc","US"],
  ["Costco","COST","NASDAQ","Distribution","sc","US"],
  ["Home Depot","HD","NYSE","Bricolage","sc","US"],
  ["Nike","NKE","NYSE","Sport mode","sc","US"],
  ["Procter Gamble","PG","NYSE","Biens consommation","sc","US"],
  ["Coca-Cola","KO","NYSE","Boissons","sc","US"],
  ["PepsiCo","PEP","NASDAQ","Boissons alimentaire","sc","US"],
  ["Goldman Sachs","GS","NYSE","Banque investissement","sc","US"],
  ["BlackRock","BLK","NYSE","Gestion actifs","sc","US"],
  ["Broadcom","AVGO","NASDAQ","Semi-conducteurs","sc","US"],
  ["Super Micro Computer","SMCI","NASDAQ","Serveurs IA","sc","US"],
  ["Micron Technology","MU","NASDAQ","Memoires semi-cond","sc","US"],
  ["Arm Holdings","ARM","NASDAQ","Architecture semi-cond","sc","GB"],
  ["Marvell Technology","MRVL","NASDAQ","Semi-conducteurs","sc","US"],
  ["MongoDB","MDB","NASDAQ","Base de donnees NoSQL","sc","US"],
  ["Cloudflare","NET","NYSE","Securite reseau","sc","US"],
  ["Datadog","DDOG","NASDAQ","Monitoring cloud","sc","US"],
  ["Zscaler","ZS","NASDAQ","Cybersecurite cloud","sc","US"],
  ["Fortinet","FTNT","NASDAQ","Cybersecurite","sc","US"],
  ["Workday","WDAY","NASDAQ","RH cloud","sc","US"],
  ["Twilio","TWLO","NYSE","Communications cloud","sc","US"],
  ["HubSpot","HUBS","NYSE","Marketing CRM","sc","US"],
  ["DoorDash","DASH","NYSE","Livraison alimentaire","sc","US"],
  ["Lyft","LYFT","NASDAQ","Mobilite VTC","sc","US"],
  ["Robinhood","HOOD","NASDAQ","Finance retail","sc","US"],
  ["Toast","TOST","NYSE","Logiciels restauration","sc","US"],
  ["Duolingo","DUOL","NASDAQ","Edtech langues","sc","US"],
  ["AppLovin","APP","NASDAQ","Publicite mobile IA","sc","US"],
  ["Vertiv","VRT","NYSE","Infrastructure data center","sc","US"],
  ["Vistra","VST","NYSE","Electricite nucleaire","sc","US"],
  ["Constellation Energy","CEG","NASDAQ","Energie nucleaire","sc","US"],
  ["GE Vernova","GEV","NYSE","Energie transition","sc","US"],
  // ======= US BIOTECH / MEDTECH MID CAP =======
  ["Alnylam","ALNY","NASDAQ","Biotech ARNi","bio","US"],
  ["Arrowhead Pharma","ARWR","NASDAQ","Biotech ARNi","bio","US"],
  ["Blueprint Medicines","BPMC","NASDAQ","Biotech oncologie","bio","US"],
  ["Exact Sciences","EXAS","NASDAQ","Diagnostics cancer","bio","US"],
  ["Guardant Health","GH","NYSE","Diagnostics liquides","bio","US"],
  ["Insulet","PODD","NASDAQ","Medtech diabete","bio","US"],
  ["Ionis Pharmaceuticals","IONS","NASDAQ","Biotech ARN","bio","US"],
  ["Natera","NTRA","NASDAQ","Diagnostics genomiques","bio","US"],
  ["Neurocrine Biosciences","NBIX","NASDAQ","Biotech neurologie","bio","US"],
  ["Novavax","NVAX","NASDAQ","Biotech vaccins","bio","US"],
  ["Rocket Pharmaceuticals","RCKT","NASDAQ","Biotech therapie genique","bio","US"],
  ["Sage Therapeutics","SAGE","NASDAQ","Biotech neurologie","bio","US"],
  ["Ultragenyx","RARE","NASDAQ","Biotech maladies rares","bio","US"],
  ["Verve Therapeutics","VERV","NASDAQ","Biotech edition genome","bio","US"],
  // ======= US TECH SMALL/MID CAP POPULAIRES SUR BOURSORAMA =======
  ["Aeva Technologies","AEVA","NASDAQ","LiDAR autonomie 4D","sc","US"],
  ["Archer Aviation","ACHR","NYSE","Aviation electrique","sc","US"],
  ["Arm Holdings","ARM","NASDAQ","Architecture processeurs","sc","GB"],
  ["AST SpaceMobile","ASTS","NASDAQ","Telecoms satellite","sc","US"],
  ["BigBear AI","BBAI","NYSE","IA defense","sc","US"],
  ["Blink Charging","BLNK","NASDAQ","Bornes recharge VE","sc","US"],
  ["Canoo","GOEV","NASDAQ","Vehicules electriques","sc","US"],
  ["ChargePoint","CHPT","NYSE","Recharge vehicules elec","sc","US"],
  ["Credo Technology","CRDO","NASDAQ","Connectivite haut debit","sc","US"],
  ["Fluence Energy","FLNC","NASDAQ","Stockage energie","sc","US"],
  ["IronSource","IS","NYSE","Monetisation appli","sc","IL"],
  ["Joby Aviation","JOBY","NYSE","Taxi aerien electrique","sc","US"],
  ["Lilium","LILM","NASDAQ","eVTOL avion electrique","sc","DE"],
  ["Lucid Group","LCID","NASDAQ","Vehicules electriques luxe","sc","US"],
  ["Luminar Technologies","LAZRQ","NASDAQ","LiDAR autonomie","sc","US"],
  ["MicroStrategy","MSTR","NASDAQ","Bitcoin intelligence","sc","US"],
  ["Mobileye","MBLY","NASDAQ","Tech conduite autonome","sc","IL"],
  ["Navitas Semiconductor","NVTS","NASDAQ","Semi-cond puissance","sc","US"],
  ["Nikola","NKLA","NASDAQ","Camions hydrogene","sc","US"],
  ["Nuvation Bio","NUVB","NYSE","Biotech oncologie","bio","US"],
  ["OSI Systems","OSIS","NASDAQ","Securite detection","sc","US"],
  ["Ouster","OUST","NYSE","LiDAR","sc","US"],
  ["Polestar","PSNY","NASDAQ","Vehicules electriques","sc","SE"],
  ["QuantumScape","QS","NYSE","Batteries solides","sc","US"],
  ["Recursion Pharmaceuticals","RXRX","NASDAQ","Biotech IA","bio","US"],
  ["Rigel Pharmaceuticals","RIGL","NASDAQ","Biotech immunologie","bio","US"],
  ["Rivian","RIVN","NASDAQ","Vehicules electriques","sc","US"],
  ["Seer Inc","SEER","NASDAQ","Proteomique diagnostics","bio","US"],
  ["SoFi Technologies","SOFI","NASDAQ","Fintech neobanque","sc","US"],
  ["Sonder Holdings","SOND","NASDAQ","Hotellerie tech","sc","US"],
  ["Symbotic","SYM","NASDAQ","Robotique logistique","sc","US"],
  ["Tempus AI","TEM","NASDAQ","IA oncologie diagnostics","bio","US"],
  ["Terran Orbital","LLAP","NYSE","Satellites","sc","US"],
  ["TuSimple","TSP","NASDAQ","Camions autonomes","sc","US"],
  ["UiPath","PATH","NYSE","Automatisation RPA","sc","US"],
  ["Unity Software","U","NYSE","Moteur jeu 3D","sc","US"],
  ["Verastem","VSTM","NASDAQ","Biotech oncologie","bio","US"],
  ["Vnet Group","VNET","NASDAQ","Data centers Chine","sc","CN"],
  ["Volato Group","SOAR","NYSE","Aviation privee","sc","US"],
  ["Vor Biopharma","VOR","NASDAQ","Biotech hematologie","bio","US"],
  ["WalkMe","WKME","NASDAQ","Adoption logiciels","sc","IL"],
  ["Xpeng","XPEV","NYSE","Vehicules electriques CN","sc","CN"],
  ["Zeekr","ZK","NYSE","Vehicules electriques luxe CN","sc","CN"],
  // ======= CHINE / ASIE COTES AUX US =======
  ["Alibaba","BABA","NYSE","E-commerce cloud CN","sc","CN"],
  ["JD.com","JD","NASDAQ","E-commerce CN","sc","CN"],
  ["Tencent","TCEHY","OTC","Tech medias CN","sc","CN"],
  ["BYD","BYDDY","OTC","Vehicules electriques CN","sc","CN"],
  ["NIO","NIO","NYSE","Vehicules electriques CN","sc","CN"],
  ["Li Auto","LI","NASDAQ","Vehicules electriques CN","sc","CN"],
  ["Baidu","BIDU","NASDAQ","Moteur recherche IA CN","sc","CN"],
  ["PDD Holdings","PDD","NASDAQ","E-commerce CN","sc","CN"],
  ["Sea Limited","SE","NYSE","Tech Asie du Sud-Est","sc","SG"],
  ["Taiwan Semiconductor","TSM","NYSE","Fonderie semico","sc","TW"],
  ["Samsung","005930.KS","KRX","Electronique semico","sc","KR"],
  ["ASML","ASML","NASDAQ","Equipements semico","sc","NL"],
  ["Sony","SONY","NYSE","Electronique medias","sc","JP"],
  ["Toyota","TM","NYSE","Automobile","sc","JP"],
  ["SoftBank","SFTBY","OTC","Tech investissement","sc","JP"],
  ["Keyence","KYCCF","OTC","Capteurs industriels","sc","JP"],
  // ======= EURONEXT GROWTH - LISTE COMPLETE ABCBOURSE =======
  ["2CRSI","AL2SI.PA","Euronext Growth","Serveurs stockage","sc","FR"],
  ["Acheter-Louer","ALALO.PA","Euronext Growth","Immobilier digital","sc","FR"],
  ["Actia Group","ALATI.PA","Euronext Growth","Electronique auto","sc","FR"],
  ["Adeunis","ALARF.PA","Euronext Growth","IoT connectivite","sc","FR"],
  ["Adomos","ALADO.PA","Euronext Growth","Immobilier","sc","FR"],
  ["Adux","ALDUX.PA","Euronext Growth","Publicite digitale","sc","FR"],
  ["Advini","ALAVI.PA","Euronext Growth","Vins","sc","FR"],
  ["Afyren","ALAFY.PA","Euronext Growth","Biotech fermentation","bio","FR"],
  ["Agripower","ALAGP.PA","Euronext Growth","Energie verte","sc","FR"],
  ["AgroGeneration","ALAGR.PA","Euronext Growth","Agriculture","sc","FR"],
  ["Airwell","ALAIR.PA","Euronext Growth","Climatisation","sc","FR"],
  ["Alchimie","ALCHI.PA","Euronext Growth","Media streaming","sc","FR"],
  ["Altheora","ALORA.PA","Euronext Growth","Plastiques techniques","sc","FR"],
  ["Ama Corporation","ALAMA.PA","Euronext Growth","Equipements sport","sc","FR"],
  ["Amoeba","ALMIB.PA","Euronext Growth","Biotech environnement","bio","FR"],
  ["Aquila AM","ALAQU.PA","Euronext Growth","Gestion actifs","sc","FR"],
  ["Archos","ALJXR.PA","Euronext Growth","Electronique grand public","sc","FR"],
  ["Arcure","ALCUR.PA","Euronext Growth","IA securite industrie","sc","FR"],
  ["Atari","ALATA.PA","Euronext Growth","Jeux video","sc","FR"],
  ["Audacia","ALAUD.PA","Euronext Growth","Holding PME","sc","FR"],
  ["Baikowski","ALBKK.PA","Euronext Growth","Materiaux alumine","sc","FR"],
  ["Bilendi","ALBLD.PA","Euronext Growth","Etudes marketing","sc","FR"],
  ["Bio UV Group","ALTUV.PA","Euronext Growth","Traitement eau UV","sc","FR"],
  ["Biosynex","ALBIO.PA","Euronext Growth","Diagnostics rapides","bio","FR"],
  ["Bluelinea","ALBLU.PA","Euronext Growth","Silver economy","sc","FR"],
  ["Boa Concept","ALBOA.PA","Euronext Growth","Logistique automatisee","sc","FR"],
  ["Broadpeak","ALBPK.PA","Euronext Growth","Video streaming","sc","FR"],
  ["Cafom","ALCAF.PA","Euronext Growth","Distribution ameublement","sc","FR"],
  ["Capelli","ALCAP.PA","Euronext Growth","Promotion immobiliere","sc","FR"],
  ["Carbios","ALCRB.PA","Euronext Growth","Biotech plastiques","bio","FR"],
  ["Carmat","ALCAR.PA","Euronext Growth","Coeur artificiel","bio","FR"],
  ["Catana Group","CATG.PA","Euronext Growth","Catamarans","sc","FR"],
  ["Celyad Oncology","CYAD.BR","Euronext Bruxelles","Biotech oncologie","bio","BE"],
  ["Cellectis","ALCLS.PA","Euronext Growth","Therapie genique","bio","FR"],
  ["Chargeurs","CRI.PA","Euronext","Produits techniques","sc","FR"],
  ["Coheris","COH.PA","Euronext","CRM analytics","sc","FR"],
  ["Crossject","ALCJ.PA","Euronext Growth","Drug delivery","bio","FR"],
  ["CS Group","CS.PA","Euronext","IT defense","sc","FR"],
  ["DBV Technologies","DBV.PA","Euronext","Biotech allergie","bio","FR"],
  ["Delta Plus Group","DLTA.PA","Euronext","EPI securite","sc","FR"],
  ["Easyvista","ALEVY.PA","Euronext Growth","Logiciels ITSM","sc","FR"],
  ["Elior Group","ELIOR.PA","Euronext","Restauration collective","sc","FR"],
  ["Energisme","ALENE.PA","Euronext Growth","Gestion energie","sc","FR"],
  ["Enensys Technologies","ALENS.PA","Euronext Growth","Diffusion TV","sc","FR"],
  ["Esker","ESK.PA","Euronext","Dematerialisation","sc","FR"],
  ["Eurobio Scientific","ALERS.PA","Euronext Growth","Diagnostics","bio","FR"],
  ["Exacompta Clairefontaine","EXAC.PA","Euronext","Papeterie","sc","FR"],
  ["Fountaine Pajot","ALFTP.PA","Euronext Growth","Catamarans luxe","sc","FR"],
  ["Galeo","ALGAL.PA","Euronext Growth","Logiciels","sc","FR"],
  ["Gaussin","ALGAU.PA","Euronext Growth","Vehicules autonomes","sc","FR"],
  ["Generix","GNRX.PA","Euronext Growth","Supply chain","sc","FR"],
  ["Genfit","GNFT.PA","Euronext","Biotech hepatologie","bio","FR"],
  ["Genomic Vision","ALGVZ.PA","Euronext Growth","Genomique","bio","FR"],
  ["GL Events","GLO.PA","Euronext","Evenementiel","sc","FR"],
  ["Globe Composite","ALGLC.PA","Euronext Growth","Materiaux composites","sc","FR"],
  ["Goupil Industrie","ALGOU.PA","Euronext Growth","Vehicules electriques",  "sc","FR"],
  ["Groupe Guillin","ALGIL.PA","Euronext Growth","Emballages plastique","sc","FR"],
  ["Groupe IRD","ALIRD.PA","Euronext Growth","Electronique","sc","FR"],
  ["Guerbet","GBT.PA","Euronext","Produits contraste","bio","FR"],
  ["HalioDx","ALHAD.PA","Euronext Growth","Diagnostics oncologie","bio","FR"],
  ["Hitechpros","ALHIT.PA","Euronext Growth","IT services","sc","FR"],
  ["Hoffman Green Cement","ALHGC.PA","Euronext Growth","Ciment bas carbone","sc","FR"],
  ["Hunnect","ALHUNN.PA","Euronext Growth","Services","sc","FR"],
  ["Hydrogen Refueling Sol","ALHRS.PA","Euronext Growth","Hydrogene","sc","FR"],
  ["Hyvia","ALHYV.PA","Euronext Growth","Vehicules hydrogene","sc","FR"],
  ["ID Logistics","IDL.PA","Euronext","Logistique","sc","FR"],
  ["Ieva Group","ALIEVA.PA","Euronext Growth","Beauty tech","sc","FR"],
  ["Innate Pharma","IPH.PA","Euronext","Biotech immunologie","bio","FR"],
  ["Innodata","INNO.PA","Euronext Growth","Data IA","sc","US"],
  ["Interparfums","ITP.PA","Euronext","Parfums","sc","FR"],
  ["Inventiva","IVA.PA","Euronext Growth","Biotech maladies rares","bio","FR"],
  ["Invibes Advertising","ALINV.PA","Euronext Growth","Publicite digitale","sc","FR"],
  ["Inotrem","ALINO.PA","Euronext Growth","Biotech inflammation","bio","FR"],
  ["Izimmo","ALIZI.PA","Euronext Growth","Immobilier","sc","FR"],
  ["Jacquet Metals","JCQ.PA","Euronext","Distribution acier","sc","FR"],
  ["Kalray","ALKAL.PA","Euronext Growth","Processeurs IA","sc","FR"],
  ["KOC","ALKOC.PA","Euronext Growth","Services","sc","FR"],
  ["Lacroix","LACR.PA","Euronext","Electronique industriel","sc","FR"],
  ["Les Hotels Baverez","ALHBV.PA","Euronext Growth","Hotellerie Paris","sc","FR"],
  ["Linedata","LIN.PA","Euronext","Logiciels finance","sc","FR"],
  ["LNA Sante","LNA.PA","Euronext","Cliniques","bio","FR"],
  ["Louis Hachette Group","ALHAC.PA","Euronext Growth","Medias edition","sc","FR"],
  ["Lumibird","LBIRD.PA","Euronext","Lasers","sc","FR"],
  ["Lysogene","LYS.PA","Euronext Growth","Biotech maladies rares","bio","FR"],
  ["Making Science","ALMKG.PA","Euronext Growth","Marketing digital","sc","ES"],
  ["Mbway","ALMBW.PA","Euronext Growth","Paiements mobile","sc","FR"],
  ["McPhy Energy","MCPHY.PA","Euronext Growth","Hydrogene electrolyseurs","sc","FR"],
  ["Median Technologies","ALMDT.PA","Euronext Growth","Medtech IA poumon","bio","FR"],
  ["Medincell","MEDCL.PA","Euronext","Drug delivery","bio","FR"],
  ["MGI Digital","ALMGI.PA","Euronext Growth","Imprimerie numerique","sc","FR"],
  ["Micropole","ALMIP.PA","Euronext Growth","Data consulting","sc","FR"],
  ["Mylab Diagnostic","ALMED.PA","Euronext Growth","Diagnostics","bio","FR"],
  ["Nano-X Imaging","NNOX","NASDAQ","Medtech imagerie","bio","IL"],
  ["Nanobiotix","NANO.PA","Euronext","Medtech radio-oncologie","bio","FR"],
  ["Neovacs","ALNEV.PA","Euronext Growth","Biotech auto-immunite","bio","FR"],
  ["Net Element","NELE.PA","Euronext Growth","Fintech","sc","FR"],
  ["NovaBay Pharmaceuticals","NBY","NYSE","Pharma","bio","US"],
  ["Obiz","ALOB.PA","Euronext Growth","Avantages salaries","sc","FR"],
  ["Oncodesign Services","ALONC.PA","Euronext Growth","Biotech oncologie","bio","FR"],
  ["Openvalue","ALOVE.PA","Euronext Growth","Services IT","sc","FR"],
  ["Orapi","ORAP.PA","Euronext Growth","Produits hygiene","sc","FR"],
  ["OSE Immunotherapeutics","OSE.PA","Euronext","Biotech immunologie","bio","FR"],
  ["Parrot","PARRO.PA","Euronext Growth","Drones","sc","FR"],
  ["Paulic Meunerie","ALPAU.PA","Euronext Growth","Meunerie","sc","FR"],
  ["Pherecydes Pharma","ALPHE.PA","Euronext Growth","Biotech phagotherapie","bio","FR"],
  ["Poujoulat","ALPJT.PA","Euronext Growth","Conduits cheminees","sc","FR"],
  ["Poxel","ALPOXL.PA","Euronext Growth","Biotech diabete","bio","FR"],
  ["Prodways","PWG.PA","Euronext","Impression 3D","sc","FR"],
  ["Quantum Genomics","ALQGC.PA","Euronext Growth","Biotech cardiovasculaire","bio","FR"],
  ["Reworld Media","ALREW.PA","Euronext Growth","Medias digitaux","sc","FR"],
  ["Roctool","ALROC.PA","Euronext Growth","Industriel composite","sc","FR"],
  ["Sensorion","ALSEN.PA","Euronext Growth","Biotech ORL","bio","FR"],
  ["Sidetrade","ALBFR.PA","Euronext Growth","Logiciels IA cash","sc","FR"],
  ["Sogeclair","SOG.PA","Euronext","Ingenierie aeronautique","sc","FR"],
  ["Theranexus","ALTHX.PA","Euronext Growth","Biotech neurologie","bio","FR"],
  ["TM Advertising","ALTMA.PA","Euronext Growth","Publicite","sc","FR"],
  ["TME Pharma","ALTME.PA","Euronext Growth","Biotech oncologie","bio","FR"],
  ["Tonner Drones","ALTD.PA","Euronext Growth","Drones defense","sc","FR"],
  ["Transgene","TNG.PA","Euronext","Biotech immunotherapie","bio","FR"],
  ["Ulysse Marine","ALUMT.PA","Euronext Growth","Nautisme","sc","FR"],
  ["Valbiotis","ALVAL.PA","Euronext Growth","Biotech nutrition","bio","FR"],
  ["Vergnet","ALVER.PA","Euronext Growth","Eoliennes","sc","FR"],
  ["Visiomed Group","ALVMG.PA","Euronext Growth","Medtech","bio","FR"],
  ["Voluntis","ALVTX.PA","Euronext Growth","Digital therapeutics","bio","FR"],
  ["Wallix Group","ALLIX.PA","Euronext Growth","Cybersecurite PAM","sc","FR"],
  ["XBT Provider","XTSE.PA","Euronext Growth","Crypto","sc","SE"],
  ["Xilam Animation","XIL.PA","Euronext Growth","Animation","sc","FR"],
,

  // ======= S&P 500 / NASDAQ =======
  ["Apple","AAPL","NASDAQ","Technologie","sc","US"],
  ["Microsoft","MSFT","NASDAQ","Technologie","sc","US"],
  ["Amazon","AMZN","NASDAQ","E-commerce","sc","US"],
  ["Nvidia","NVDA","NASDAQ","Semi-conducteurs","sc","US"],
  ["Alphabet A","GOOGL","NASDAQ","Technologie","sc","US"],
  ["Alphabet C","GOOG","NASDAQ","Technologie","sc","US"],
  ["Meta","META","NASDAQ","Technologie","sc","US"],
  ["Berkshire B","BRK-B","NYSE","Finance","sc","US"],
  ["Tesla","TSLA","NASDAQ","Automobile","sc","US"],
  ["Eli Lilly","LLY","NYSE","Pharma","bio","US"],
  ["UnitedHealth","UNH","NYSE","Sante","sc","US"],
  ["Exxon Mobil","XOM","NYSE","Energie","sc","US"],
  ["Visa","V","NYSE","Paiements","sc","US"],
  ["Johnson & Johnson","JNJ","NYSE","Sante","bio","US"],
  ["Procter & Gamble","PG","NYSE","Consommation","sc","US"],
  ["JPMorgan Chase","JPM","NYSE","Banque","sc","US"],
  ["Mastercard","MA","NYSE","Paiements","sc","US"],
  ["Chevron","CVX","NYSE","Energie","sc","US"],
  ["Home Depot","HD","NYSE","Distribution","sc","US"],
  ["AbbVie","ABBV","NYSE","Pharma","bio","US"],
  ["Merck","MRK","NYSE","Pharma","bio","US"],
  ["Costco","COST","NASDAQ","Distribution","sc","US"],
  ["Coca-Cola","KO","NYSE","Boissons","sc","US"],
  ["PepsiCo","PEP","NASDAQ","Boissons","sc","US"],
  ["Walmart","WMT","NYSE","Distribution","sc","US"],
  ["Salesforce","CRM","NYSE","Logiciel","sc","US"],
  ["Oracle","ORCL","NYSE","Logiciel","sc","US"],
  ["AMD","AMD","NASDAQ","Semi-conducteurs","sc","US"],
  ["Netflix","NFLX","NASDAQ","Streaming","sc","US"],
  ["Adobe","ADBE","NASDAQ","Logiciel","sc","US"],
  ["Thermo Fisher","TMO","NYSE","Sciences","bio","US"],
  ["Danaher","DHR","NYSE","Sciences","bio","US"],
  ["Caterpillar","CAT","NYSE","Industrie","sc","US"],
  ["Boeing","BA","NYSE","Aeronautique","sc","US"],
  ["Honeywell","HON","NASDAQ","Industrie","sc","US"],
  ["3M","MMM","NYSE","Industrie","sc","US"],
  ["Lockheed Martin","LMT","NYSE","Defense","sc","US"],
  ["Raytheon","RTX","NYSE","Defense","sc","US"],
  ["GE Aerospace","GE","NYSE","Aeronautique","sc","US"],
  ["Deere","DE","NYSE","Industrie","sc","US"],
  ["Emerson Electric","EMR","NYSE","Industrie","sc","US"],
  ["Parker Hannifin","PH","NYSE","Industrie","sc","US"],
  ["Northrop Grumman","NOC","NYSE","Defense","sc","US"],
  ["General Dynamics","GD","NYSE","Defense","sc","US"],
  ["Texas Instruments","TXN","NASDAQ","Semi-conducteurs","sc","US"],
  ["Intel","INTC","NASDAQ","Semi-conducteurs","sc","US"],
  ["Qualcomm","QCOM","NASDAQ","Semi-conducteurs","sc","US"],
  ["Broadcom","AVGO","NASDAQ","Semi-conducteurs","sc","US"],
  ["Applied Materials","AMAT","NASDAQ","Semi-conducteurs","sc","US"],
  ["ASML","ASML","NASDAQ","Semi-conducteurs","sc","NL"],
  ["Lam Research","LRCX","NASDAQ","Semi-conducteurs","sc","US"],
  ["KLA Corp","KLAC","NASDAQ","Semi-conducteurs","sc","US"],
  ["Micron","MU","NASDAQ","Semi-conducteurs","sc","US"],
  ["Western Digital","WDC","NASDAQ","Technologie","sc","US"],
  ["Seagate","STX","NASDAQ","Technologie","sc","US"],
  ["Skyworks","SWKS","NASDAQ","Semi-conducteurs","sc","US"],
  ["Analog Devices","ADI","NASDAQ","Semi-conducteurs","sc","US"],
  ["Marvell Tech","MRVL","NASDAQ","Semi-conducteurs","sc","US"],
  ["ON Semiconductor","ON","NASDAQ","Semi-conducteurs","sc","US"],
  ["Microchip Tech","MCHP","NASDAQ","Semi-conducteurs","sc","US"],
  ["PayPal","PYPL","NASDAQ","Paiements","sc","US"],
  ["Block","SQ","NYSE","Fintech","sc","US"],
  ["Intuit","INTU","NASDAQ","Logiciel","sc","US"],
  ["ServiceNow","NOW","NYSE","Logiciel","sc","US"],
  ["Workday","WDAY","NASDAQ","Logiciel","sc","US"],
  ["Palo Alto","PANW","NASDAQ","Cybersecurite","sc","US"],
  ["CrowdStrike","CRWD","NASDAQ","Cybersecurite","sc","US"],
  ["Fortinet","FTNT","NASDAQ","Cybersecurite","sc","US"],
  ["Zscaler","ZS","NASDAQ","Cybersecurite","sc","US"],
  ["Cloudflare","NET","NYSE","Cybersecurite","sc","US"],
  ["Datadog","DDOG","NASDAQ","Cloud","sc","US"],
  ["Snowflake","SNOW","NYSE","Cloud","sc","US"],
  ["MongoDB","MDB","NASDAQ","Cloud","sc","US"],
  ["HubSpot","HUBS","NYSE","Logiciel","sc","US"],
  ["Twilio","TWLO","NYSE","Cloud","sc","US"],
  ["Okta","OKTA","NASDAQ","Cybersecurite","sc","US"],
  ["Splunk","SPLK","NASDAQ","Cloud","sc","US"],
  ["Autodesk","ADSK","NASDAQ","Logiciel","sc","US"],
  ["Synopsys","SNPS","NASDAQ","Logiciel","sc","US"],
  ["Cadence Design","CDNS","NASDAQ","Logiciel","sc","US"],
  ["Veeva Systems","VEEV","NYSE","Logiciel","bio","US"],
  ["Zoom","ZM","NASDAQ","Communication","sc","US"],
  ["Spotify","SPOT","NYSE","Streaming","sc","SE"],
  ["Uber","UBER","NYSE","Mobilite","sc","US"],
  ["Lyft","LYFT","NASDAQ","Mobilite","sc","US"],
  ["Airbnb","ABNB","NASDAQ","Tourisme","sc","US"],
  ["DoorDash","DASH","NYSE","Livraison","sc","US"],
  ["Instacart","CART","NASDAQ","Livraison","sc","US"],
  ["Robinhood","HOOD","NASDAQ","Fintech","sc","US"],
  ["Coinbase","COIN","NASDAQ","Crypto","sc","US"],
  ["Goldman Sachs","GS","NYSE","Banque","sc","US"],
  ["Morgan Stanley","MS","NYSE","Banque","sc","US"],
  ["Bank of America","BAC","NYSE","Banque","sc","US"],
  ["Wells Fargo","WFC","NYSE","Banque","sc","US"],
  ["Citigroup","C","NYSE","Banque","sc","US"],
  ["BlackRock","BLK","NYSE","Gestion actifs","sc","US"],
  ["Charles Schwab","SCHW","NYSE","Finance","sc","US"],
  ["Ameriprise","AMP","NYSE","Finance","sc","US"],
  ["T. Rowe Price","TROW","NASDAQ","Finance","sc","US"],
  ["American Express","AXP","NYSE","Finance","sc","US"],
  ["Moody's","MCO","NYSE","Finance","sc","US"],
  ["S&P Global","SPGI","NYSE","Finance","sc","US"],
  ["MSCI","MSCI","NYSE","Finance","sc","US"],
  ["Intercontinental Exchange","ICE","NYSE","Finance","sc","US"],
  ["CME Group","CME","NASDAQ","Finance","sc","US"],
  ["Cboe Global","CBOE","CBOE","Finance","sc","US"],
  ["Nasdaq Inc","NDAQ","NASDAQ","Finance","sc","US"],
  ["Pfizer","PFE","NYSE","Pharma","bio","US"],
  ["Moderna","MRNA","NASDAQ","Biotech","bio","US"],
  ["BioNTech","BNTX","NASDAQ","Biotech","bio","US"],
  ["Regeneron","REGN","NASDAQ","Biotech","bio","US"],
  ["Gilead","GILD","NASDAQ","Biotech","bio","US"],
  ["Amgen","AMGN","NASDAQ","Biotech","bio","US"],
  ["Biogen","BIIB","NASDAQ","Biotech","bio","US"],
  ["Vertex","VRTX","NASDAQ","Biotech","bio","US"],
  ["Illumina","ILMN","NASDAQ","Genomique","bio","US"],
  ["Exact Sciences","EXAS","NASDAQ","Diagnostics","bio","US"],
  ["Guardant Health","GH","NASDAQ","Diagnostics","bio","US"],
  ["Agilent","A","NYSE","Sciences","bio","US"],
  ["Mettler-Toledo","MTD","NYSE","Instruments","sc","US"],
  ["Waters Corp","WAT","NYSE","Instruments","sc","US"],
  ["Bio-Techne","TECH","NASDAQ","Biotech","bio","US"],
  ["10x Genomics","TXG","NASDAQ","Genomique","bio","US"],
  ["Intuitive Surgical","ISRG","NASDAQ","Medtech","bio","US"],
  ["Edwards Lifesciences","EW","NYSE","Medtech","bio","US"],
  ["Becton Dickinson","BDX","NYSE","Medtech","bio","US"],
  ["Boston Scientific","BSX","NYSE","Medtech","bio","US"],
  ["Stryker","SYK","NYSE","Medtech","bio","US"],
  ["Zimmer Biomet","ZBH","NYSE","Medtech","bio","US"],
  ["Hologic","HOLX","NASDAQ","Medtech","bio","US"],
  ["Globus Medical","GMED","NYSE","Medtech","bio","US"],
  ["Insulet","PODD","NASDAQ","Medtech","bio","US"],
  ["Tandem Diabetes","TNDM","NASDAQ","Medtech","bio","US"],
  ["DexCom","DXCM","NASDAQ","Medtech","bio","US"],
  ["Align Tech","ALGN","NASDAQ","Medtech","bio","US"],
  ["ResMed","RMD","NYSE","Medtech","bio","US"],
  ["Penumbra","PEN","NYSE","Medtech","bio","US"],
  ["Ecolab","ECL","NYSE","Chimie","sc","US"],
  ["Air Products","APD","NYSE","Gaz industriels","sc","US"],
  ["Linde","LIN","NYSE","Gaz industriels","sc","US"],
  ["Sherwin-Williams","SHW","NYSE","Peinture","sc","US"],
  ["PPG Industries","PPG","NYSE","Chimie","sc","US"],
  ["Dow","DOW","NYSE","Chimie","sc","US"],
  ["LyondellBasell","LYB","NYSE","Chimie","sc","US"],
  ["Celanese","CE","NYSE","Chimie","sc","US"],
  ["NextEra Energy","NEE","NYSE","Energie renouvelable","sc","US"],
  ["Duke Energy","DUK","NYSE","Utilities","sc","US"],
  ["Southern Company","SO","NYSE","Utilities","sc","US"],
  ["Dominion Energy","D","NYSE","Utilities","sc","US"],
  ["Exelon","EXC","NASDAQ","Utilities","sc","US"],
  ["American Electric","AEP","NASDAQ","Utilities","sc","US"],
  ["Consolidated Edison","ED","NYSE","Utilities","sc","US"],
  ["Sempra","SRE","NYSE","Energie","sc","US"],
  ["Xcel Energy","XEL","NASDAQ","Energie renouvelable","sc","US"],
  ["Ormat Technologies","ORA","NYSE","Energie renouvelable","sc","US"],
  ["First Solar","FSLR","NASDAQ","Energie solaire","sc","US"],
  ["Enphase","ENPH","NASDAQ","Energie solaire","sc","US"],
  ["SolarEdge","SEDG","NASDAQ","Energie solaire","sc","US"],
  ["Array Tech","ARRY","NASDAQ","Energie solaire","sc","US"],
  ["Sunrun","RUN","NASDAQ","Energie solaire","sc","US"],
  ["Marathon Petroleum","MPC","NYSE","Petrole","sc","US"],
  ["Valero Energy","VLO","NYSE","Petrole","sc","US"],
  ["Phillips 66","PSX","NYSE","Petrole","sc","US"],
  ["ConocoPhillips","COP","NYSE","Petrole","sc","US"],
  ["EOG Resources","EOG","NYSE","Petrole","sc","US"],
  ["Pioneer Natural","PXD","NYSE","Petrole","sc","US"],
  ["Occidental","OXY","NYSE","Petrole","sc","US"],
  ["Schlumberger","SLB","NYSE","Services petroliers","sc","US"],
  ["Halliburton","HAL","NYSE","Services petroliers","sc","US"],
  ["Baker Hughes","BKR","NASDAQ","Services petroliers","sc","US"],
  ["FMC Technologies","FTI","NYSE","Services petroliers","sc","US"],
  ["Crown Castle","CCI","NYSE","Infra telecoms","sc","US"],
  ["American Tower","AMT","NYSE","Infra telecoms","sc","US"],
  ["SBA Comms","SBAC","NASDAQ","Infra telecoms","sc","US"],
  ["T-Mobile","TMUS","NASDAQ","Telecoms","sc","US"],
  ["AT&T","T","NYSE","Telecoms","sc","US"],
  ["Verizon","VZ","NYSE","Telecoms","sc","US"],
  ["Comcast","CMCSA","NASDAQ","Media","sc","US"],
  ["Charter Comms","CHTR","NASDAQ","Telecoms","sc","US"],
  ["Walt Disney","DIS","NYSE","Media","sc","US"],
  ["Fox Corp","FOXA","NASDAQ","Media","sc","US"],
  ["Warner Bros","WBD","NASDAQ","Media","sc","US"],
  ["Paramount","PARA","NASDAQ","Media","sc","US"],
  ["Live Nation","LYV","NYSE","Entertainment","sc","US"],
  ["Madison Square Garden","MSGE","NYSE","Entertainment","sc","US"],
  ["Nike","NKE","NYSE","Sport","sc","US"],
  ["VF Corporation","VFC","NYSE","Habillement","sc","US"],
  ["PVH Corp","PVH","NYSE","Habillement","sc","US"],
  ["Tapestry","TPR","NYSE","Luxe","sc","US"],
  ["Capri Holdings","CPRI","NYSE","Luxe","sc","US"],
  ["Estee Lauder","EL","NYSE","Cosmetique","sc","US"],
  ["Coty","COTY","NYSE","Cosmetique","sc","US"],
  ["Church & Dwight","CHD","NYSE","Consommation","sc","US"],
  ["Colgate","CL","NYSE","Consommation","sc","US"],
  ["Kimberly-Clark","KMB","NYSE","Consommation","sc","US"],
  ["General Mills","GIS","NYSE","Agroalimentaire","sc","US"],
  ["Kellogg","K","NYSE","Agroalimentaire","sc","US"],
  ["Hershey","HSY","NYSE","Agroalimentaire","sc","US"],
  ["Mondelez","MDLZ","NASDAQ","Agroalimentaire","sc","US"],
  ["Kraft Heinz","KHC","NASDAQ","Agroalimentaire","sc","US"],
  ["Sysco","SYY","NYSE","Distribution","sc","US"],
  ["Target","TGT","NYSE","Distribution","sc","US"],
  ["Dollar General","DG","NYSE","Distribution","sc","US"],
  ["Dollar Tree","DLTR","NASDAQ","Distribution","sc","US"],
  ["Ross Stores","ROST","NASDAQ","Distribution","sc","US"],
  ["TJX Companies","TJX","NYSE","Distribution","sc","US"],
  ["Booking Holdings","BKNG","NASDAQ","Tourisme","sc","US"],
  ["Expedia","EXPE","NASDAQ","Tourisme","sc","US"],
  ["Marriott","MAR","NASDAQ","Hotellerie","sc","US"],
  ["Hilton","HLT","NYSE","Hotellerie","sc","US"],
  ["McDonald's","MCD","NYSE","Restauration","sc","US"],
  ["Starbucks","SBUX","NASDAQ","Restauration","sc","US"],
  ["Yum Brands","YUM","NYSE","Restauration","sc","US"],
  ["Chipotle","CMG","NYSE","Restauration","sc","US"],
  ["Darden Restaurants","DRI","NYSE","Restauration","sc","US"],
  ["Automatic Data","ADP","NASDAQ","RH tech","sc","US"],
  ["Paychex","PAYX","NASDAQ","RH tech","sc","US"],
  ["Gartner","IT","NYSE","Conseil IT","sc","US"],
  ["Accenture","ACN","NYSE","Conseil IT","sc","US"],
  ["IBM","IBM","NYSE","Technologie","sc","US"],
  ["Hewlett Packard","HPQ","NYSE","Technologie","sc","US"],
  ["HP Enterprise","HPE","NYSE","Technologie","sc","US"],
  ["Dell","DELL","NYSE","Technologie","sc","US"],
  ["NCR Atleos","NATL","NYSE","Technologie","sc","US"],
  ["Xerox","XRX","NASDAQ","Technologie","sc","US"],
  ["Cognizant","CTSH","NASDAQ","Conseil IT","sc","US"],
  ["DXC Technology","DXC","NYSE","Conseil IT","sc","US"],
  ["Leidos","LDOS","NYSE","Defense tech","sc","US"],
  ["SAIC","SAIC","NYSE","Defense tech","sc","US"],
  ["Booz Allen","BAH","NYSE","Conseil defense","sc","US"],
  ["CACI","CACI","NYSE","Conseil defense","sc","US"],
  ["HSBC","HSBA.L","LSE","Banque","sc","GB"],
  ["Shell","SHEL.L","LSE","Energie","sc","GB"],
  ["AstraZeneca","AZN.L","LSE","Pharma","bio","GB"],
  ["Unilever","ULVR.L","LSE","Consommation","sc","GB"],
  ["BP","BP.L","LSE","Energie","sc","GB"],
  ["Rio Tinto","RIO.L","LSE","Mines","sc","GB"],
  ["BHP","BHP.L","LSE","Mines","sc","AU"],
  ["Diageo","DGE.L","LSE","Boissons","sc","GB"],
  ["GSK","GSK.L","LSE","Pharma","bio","GB"],
  ["Glencore","GLEN.L","LSE","Mines","sc","CH"],
  ["Barclays","BARC.L","LSE","Banque","sc","GB"],

  // ======= FTSE 100 =======
  ["Lloyds Banking","LLOY.L","LSE","Banque","sc","GB"],
  ["NatWest","NWG.L","LSE","Banque","sc","GB"],
  ["Standard Chartered","STAN.L","LSE","Banque","sc","GB"],
  ["Rolls-Royce","RR.L","LSE","Aeronautique","sc","GB"],
  ["BAE Systems","BA.L","LSE","Defense","sc","GB"],
  ["Vodafone","VOD.L","LSE","Telecoms","sc","GB"],
  ["BT Group","BT-A.L","LSE","Telecoms","sc","GB"],
  ["National Grid","NG.L","LSE","Utilities","sc","GB"],
  ["SSE","SSE.L","LSE","Energie renouvelable","sc","GB"],
  ["Centrica","CNA.L","LSE","Energie","sc","GB"],
  ["Anglo American","AAL.L","LSE","Mines","sc","GB"],
  ["Antofagasta","ANTO.L","LSE","Mines","sc","CL"],
  ["Fresnillo","FRES.L","LSE","Mines","sc","MX"],
  ["Haleon","HLN.L","LSE","Sante","sc","GB"],
  ["Smith & Nephew","SN.L","LSE","Medtech","bio","GB"],
  ["Hikma","HIK.L","LSE","Pharma","bio","GB"],
  ["Dechra","DPH.L","LSE","Pharma","bio","GB"],
  ["Compass Group","CPG.L","LSE","Restauration","sc","GB"],
  ["Whitbread","WTB.L","LSE","Hotellerie","sc","GB"],
  ["Intercontinental Hotels","IHG.L","LSE","Hotellerie","sc","GB"],
  ["JD Sports","JD.L","LSE","Sport","sc","GB"],
  ["Next","NXT.L","LSE","Distribution","sc","GB"],
  ["Marks Spencer","MKS.L","LSE","Distribution","sc","GB"],
  ["Tesco","TSCO.L","LSE","Distribution","sc","GB"],
  ["J Sainsbury","SBRY.L","LSE","Distribution","sc","GB"],
  ["WPP","WPP.L","LSE","Communication","sc","GB"],
  ["Pearson","PSON.L","LSE","Education","sc","GB"],
  ["RELX","REL.L","LSE","Information","sc","GB"],
  ["Informa","INF.L","LSE","Media","sc","GB"],
  ["Auto Trader","AUTO.L","LSE","Technologie","sc","GB"],
  ["Rightmove","RMV.L","LSE","Immobilier","sc","GB"],
  ["Segro","SGRO.L","LSE","Immobilier","sc","GB"],
  ["Land Securities","LAND.L","LSE","Immobilier","sc","GB"],
  ["British Land","BLND.L","LSE","Immobilier","sc","GB"],
  ["3i Group","III.L","LSE","Capital investissement","sc","GB"],
  ["Legal & General","LGEN.L","LSE","Assurance","sc","GB"],
  ["Prudential","PRU.L","LSE","Assurance","sc","GB"],
  ["Aviva","AV.L","LSE","Assurance","sc","GB"],
  ["Standard Life","SLA.L","LSE","Assurance","sc","GB"],
  ["Admiral Group","ADM.L","LSE","Assurance","sc","GB"],
  ["Sage Group","SGE.L","LSE","Logiciel","sc","GB"],
  ["Micro Focus","MCRO.L","LSE","Logiciel","sc","GB"],
  ["Aveva","AVV.L","LSE","Logiciel","sc","GB"],
  ["ARM Holdings","ARM","NASDAQ","Semi-conducteurs","sc","GB"],
  ["SAP","SAP.DE","XETRA","Logiciel","sc","DE"],
  ["Siemens","SIE.DE","XETRA","Industrie","sc","DE"],
  ["Allianz","ALV.DE","XETRA","Assurance","sc","DE"],
  ["BASF","BAS.DE","XETRA","Chimie","sc","DE"],
  ["Volkswagen","VOW3.DE","XETRA","Automobile","sc","DE"],
  ["BMW","BMW.DE","XETRA","Automobile","sc","DE"],
  ["Mercedes-Benz","MBG.DE","XETRA","Automobile","sc","DE"],
  ["Bayer","BAYN.DE","XETRA","Pharma","bio","DE"],
  ["Deutsche Telekom","DTE.DE","XETRA","Telecoms","sc","DE"],
  ["Deutsche Bank","DBK.DE","XETRA","Banque","sc","DE"],

  // ======= DAX 40 =======
  ["Commerzbank","CBK.DE","XETRA","Banque","sc","DE"],
  ["Munich Re","MUV2.DE","XETRA","Assurance","sc","DE"],
  ["Hannover Re","HNR1.DE","XETRA","Assurance","sc","DE"],
  ["Deutsche Post","DPW.DE","XETRA","Logistique","sc","DE"],
  ["Deutsche Boerse","DB1.DE","XETRA","Finance","sc","DE"],
  ["Infineon","IFX.DE","XETRA","Semi-conducteurs","sc","DE"],
  ["ADIDAS","ADS.DE","XETRA","Sport","sc","DE"],
  ["Henkel","HEN3.DE","XETRA","Consommation","sc","DE"],
  ["Beiersdorf","BEI.DE","XETRA","Cosmetique","sc","DE"],
  ["Fresenius","FRE.DE","XETRA","Sante","bio","DE"],
  ["Fresenius Medical","FME.DE","XETRA","Medtech","bio","DE"],
  ["Merck KGaA","MRK.DE","XETRA","Pharma","bio","DE"],
  ["Sartorius","SRT3.DE","XETRA","Biotech","bio","DE"],
  ["Qiagen","QIA.DE","XETRA","Diagnostics","bio","DE"],
  ["HeidelbergCement","HEI.DE","XETRA","Construction","sc","DE"],
  ["RWE","RWE.DE","XETRA","Energie renouvelable","sc","DE"],
  ["E.ON","EOAN.DE","XETRA","Utilities","sc","DE"],
  ["Vonovia","VNA.DE","XETRA","Immobilier","sc","DE"],
  ["Continental","CON.DE","XETRA","Automobile","sc","DE"],
  ["Porsche AG","P911.DE","XETRA","Automobile","sc","DE"],
  ["Porsche SE","PAH3.DE","XETRA","Automobile","sc","DE"],
  ["Rheinmetall","RHM.DE","XETRA","Defense","sc","DE"],
  ["Airbus","AIR.PA","XETRA","Aeronautique","sc","FR"],
  ["MTU Aero","MTX.DE","XETRA","Aeronautique","sc","DE"],
  ["Brenntag","BNR.DE","XETRA","Chimie","sc","DE"],
  ["Covestro","1COV.DE","XETRA","Chimie","sc","DE"],
  ["Daimler Truck","DTG.DE","XETRA","Transport","sc","DE"],
  ["Symrise","SY1.DE","XETRA","Chimie","sc","DE"],
  ["Zalando","ZAL.DE","XETRA","E-commerce","sc","DE"],
  ["Scout24","G24.DE","XETRA","Internet","sc","DE"],
  ["ASML Holding","ASML.AS","Euronext Amsterdam","Semi-conducteurs","sc","NL"],
  ["Shell","SHELL.AS","Euronext Amsterdam","Energie","sc","NL"],
  ["ING Groep","INGA.AS","Euronext Amsterdam","Banque","sc","NL"],
  ["Unilever NL","UNA.AS","Euronext Amsterdam","Consommation","sc","NL"],
  ["Heineken","HEIA.AS","Euronext Amsterdam","Boissons","sc","NL"],
  ["Philips","PHIA.AS","Euronext Amsterdam","Medtech","bio","NL"],
  ["Wolters Kluwer","WKL.AS","Euronext Amsterdam","Information","sc","NL"],
  ["NN Group","NN.AS","Euronext Amsterdam","Assurance","sc","NL"],
  ["ABN Amro","ABN.AS","Euronext Amsterdam","Banque","sc","NL"],
  ["Randstad","RAND.AS","Euronext Amsterdam","RH","sc","NL"],

  // ======= AEX + SMI =======
  ["Akzo Nobel","AKZA.AS","Euronext Amsterdam","Chimie","sc","NL"],
  ["IMCD","IMCD.AS","Euronext Amsterdam","Chimie","sc","NL"],
  ["Nedap","NEDAP.AS","Euronext Amsterdam","Technologie","sc","NL"],
  ["Novartis","NOVN.SW","SIX Swiss","Pharma","bio","CH"],
  ["Roche","ROG.SW","SIX Swiss","Pharma","bio","CH"],
  ["Nestle","NESN.SW","SIX Swiss","Agroalimentaire","sc","CH"],
  ["UBS","UBSG.SW","SIX Swiss","Banque","sc","CH"],
  ["ABB","ABBN.SW","SIX Swiss","Industrie","sc","CH"],
  ["Richemont","CFR.SW","SIX Swiss","Luxe","sc","CH"],
  ["Zurich Insurance","ZURN.SW","SIX Swiss","Assurance","sc","CH"],
  ["Swiss Re","SREN.SW","SIX Swiss","Assurance","sc","CH"],
  ["Partners Group","PGHN.SW","SIX Swiss","Finance","sc","CH"],
  ["Lonza","LONN.SW","SIX Swiss","Biotech","bio","CH"],
  ["Straumann","STMN.SW","SIX Swiss","Medtech","bio","CH"],
  ["Sika","SIKA.SW","SIX Swiss","Chimie","sc","CH"],
  ["Geberit","GEBN.SW","SIX Swiss","Industrie","sc","CH"],
  ["SGS","SGSN.SW","SIX Swiss","Inspection","sc","CH"],
  ["Sonova","SOON.SW","SIX Swiss","Medtech","bio","CH"],
  ["Kuehne Nagel","KNIN.SW","SIX Swiss","Logistique","sc","CH"],
  ["Toyota","TM","NYSE","Automobile","sc","JP"],
  ["Sony","SONY","NYSE","Electronique","sc","JP"],
  ["Honda","HMC","NYSE","Automobile","sc","JP"],
  ["SoftBank","SFTBY","OTC","Technologie","sc","JP"],
  ["Keyence","KYCCF","OTC","Instruments","sc","JP"],
  ["Recruit Holdings","RCRUY","OTC","RH tech","sc","JP"],
  ["Shin-Etsu Chem","SHECY","OTC","Chimie","sc","JP"],
  ["Tokyo Electron","TOELY","OTC","Semi-conducteurs","sc","JP"],
  ["Samsung","005930.KS","KRX","Semi-conducteurs","sc","KR"],
  ["SK Hynix","000660.KS","KRX","Semi-conducteurs","sc","KR"],

  // ======= ASIE / AMERIQUE LATINE =======
  ["TSMC","TSM","NYSE","Semi-conducteurs","sc","TW"],
  ["Alibaba","BABA","NYSE","E-commerce","sc","CN"],
  ["Tencent","TCEHY","OTC","Technologie","sc","CN"],
  ["JD.com","JD","NASDAQ","E-commerce","sc","CN"],
  ["Baidu","BIDU","NASDAQ","Technologie","sc","CN"],
  ["NIO","NIO","NYSE","Automobile elec","sc","CN"],
  ["BYD","BYDDY","OTC","Automobile elec","sc","CN"],
  ["CATL","300750.SZ","SZE","Batteries","sc","CN"],
  ["Infosys","INFY","NYSE","Conseil IT","sc","IN"],
  ["Wipro","WIT","NYSE","Conseil IT","sc","IN"],
  ["HDFC Bank","HDB","NYSE","Banque","sc","IN"],
  ["ICICI Bank","IBN","NYSE","Banque","sc","IN"],
  ["Reliance","RELIANCE.NS","NSE","Conglomerat","sc","IN"],
  ["Vale","VALE","NYSE","Mines","sc","BR"],
  ["Petrobras","PBR","NYSE","Petrole","sc","BR"],
  ["Itau Unibanco","ITUB","NYSE","Banque","sc","BR"],
  ["MercadoLibre","MELI","NASDAQ","E-commerce","sc","AR"],
  ["Copa Holdings","CPA","NYSE","Transport aerien","sc","PA"]
];

// -- SEARCH ENGINE ----------------------------------------------------------
let acFocusIdx = -1;
let acVisible = false;
let acDebounce = null;

function normalize(s){ return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9 ]/g,' ').trim(); }

function showAC(items, query){
  var list = document.getElementById('acList');
  if(!list) return;
  list.innerHTML = '';
  if(!items || !items.length){ hideAC(); return; }
  items.forEach(function(item, i){
    var div = document.createElement('div');
    div.className = 'ac-item';
    var isBio = item[4] === 'bio';
    var flag = item[5]||'';
    div.innerHTML =
      '<div style="display:flex;flex-direction:column;flex:1;min-width:0;">'
      +'<div style="display:flex;align-items:center;gap:6px;">'
      +'<span style="font-size:13px;font-weight:600;color:var(--text);">'+highlightMatch(item[0], query)+'</span>'
      +(isBio?'<span style="font-size:9px;font-weight:700;background:var(--teal-bg);color:var(--teal);padding:1px 5px;border-radius:4px;">BIO</span>':'')
      +'</div>'
      +'<div style="font-size:10px;color:var(--muted);display:flex;gap:8px;margin-top:1px;">'
      +'<span style="font-family:monospace;font-weight:600;color:var(--accent);">'+item[1]+'</span>'
      +'<span>'+item[2]+'</span>'
      +(item[3]?'<span style="color:var(--muted);">'+item[3]+'</span>':'')
      +'</div>'
      +'</div>'
      +'<span style="font-size:10px;font-weight:700;color:var(--muted);flex-shrink:0;">'+flag+'</span>';
    div.addEventListener('click', function(){
      var inp = document.getElementById('cInput');
      if(inp) inp.value = item[0];
      hideAC();
      // Set type: bio is unambiguous. For equities, auto-detect from marketCap hint in AC_DB
      if(isBio){
        sT('bio');
      } else {
        // Use market field as hint: if known large index → large cap
        var mkt = (item[2]||'').toLowerCase();
        var isLarge = mkt.indexOf('nasdaq')!==-1||mkt.indexOf('nyse')!==-1||
                      mkt.indexOf('xetra')!==-1||mkt.indexOf('euronext amsterdam')!==-1||
                      mkt.indexOf('lse')!==-1||mkt.indexOf('six')!==-1;
        // Also detect large from name patterns in AC_DB sector
        var sec4 = (item[3]||'').toLowerCase();
        // Fallback: don't force, just highlight the choice
        sT(isLarge ? 'large' : 'sc');
      }
      var hint = document.getElementById('searchHint');
      if(hint) hint.textContent = item[1] + ' · ' + item[2] + (isBio ? ' · 🧬 Biotech' : ' · vérifiez le type');
    });
    div.addEventListener('mouseenter', function(){ acFocusIdx = i; updateAcFocus(); });
    list.appendChild(div);
  });
  list.classList.add('on');
  acVisible = true;
  acFocusIdx = -1;
}

function hideAC(){
  var list = document.getElementById('acList');
  if(list){ list.classList.remove('on'); list.innerHTML=''; }
  acVisible = false; acFocusIdx = -1;
}

function updateAcFocus(){
  var items = document.querySelectorAll('#acList .ac-item');
  items.forEach(function(el, i){ el.classList.toggle('focused', i === acFocusIdx); });
}

function highlightMatch(text, query){
  const nText = normalize(text);
  const nQuery = normalize(query);
  const idx = nText.indexOf(nQuery);
  if(idx === -1) return text;
  return text.slice(0,idx) + '<em>' + text.slice(idx, idx+query.length) + '</em>' + text.slice(idx+query.length);
}

function scoreMatch(item, query){
  const q = normalize(query);
  const name = normalize(item[0]);
  const ticker = normalize(item[1]);
  const sector = normalize(item[4] === 'bio' ? 'biotech medtech pharma ' + item[3] : item[3]);
  
  // Exact ticker match -> highest priority
  if(ticker.replace('.pa','').replace('.as','').replace('.de','') === q.replace('.pa','').replace('.as','').replace('.de','')) return 100;
  // Starts with name
  if(name.startsWith(q)) return 90 - q.length;
  // Starts with any word in name
  const words = name.split(' ');
  for(const w of words){ if(w.startsWith(q)) return 80; }
  // Contains in name
  if(name.includes(q)) return 70;
  // Contains in ticker
  if(ticker.includes(q)) return 60;
  // Contains in sector
  if(sector.includes(q)) return 40;
  // Fuzzy: all chars present in order
  let ni = 0;
  for(const c of q){ ni = name.indexOf(c, ni); if(ni===-1) break; ni++; }
  if(ni !== -1) return 20;
  return -1;
}

function onSearchInput(val){
  clearTimeout(acDebounce);
  var query = val.trim();
  if(query.length < 1){ hideAC(); document.getElementById('searchHint').textContent=''; return; }

  // ── 1. Show local AC_DB results INSTANTLY ────────────────────────────
  var localResults = searchLocalDB(query);
  if(localResults.length > 0) showAC(localResults, query);

  // ── 2. Yahoo Finance real-time search (debounced 250ms) ──────────────
  acDebounce = setTimeout(async function(){
    var yhResults = await searchYahooFinance(query);
    if(!yhResults || !yhResults.length) return;
    // Merge: Yahoo results that are NOT already in local
    var localTickers = localResults.map(function(r){ return r[1]; });
    var merged = localResults.slice();
    yhResults.forEach(function(yh){
      if(localTickers.indexOf(yh[1]) === -1) merged.push(yh);
    });
    showAC(merged, query);
  }, 250);
}

function searchLocalDB(query){
  var q = query.toLowerCase().trim();
  var scored = AC_DB.map(function(item){
    return {item: item, score: scoreMatch(item, q)};
  }).filter(function(x){ return x.score > 0; })
    .sort(function(a,b){ return b.score - a.score; });
  return scored.slice(0, 12).map(function(x){ return x.item; });
}

async function searchYahooFinance(query){
  try{
    var url = 'https://query1.finance.yahoo.com/v1/finance/search?q='
      + encodeURIComponent(query)
      + '&quotesCount=10&newsCount=0&enableFuzzyQuery=true&quotesQueryId=tss_match_phrase_query';
    var resp = await fetch(url, {signal: AbortSignal.timeout(4000)});
    if(!resp.ok) return [];
    var d = await resp.json();
    return (d.quotes || [])
      .filter(function(q){ return q.quoteType === 'EQUITY' && q.symbol; })
      .slice(0, 8)
      .map(function(q){
        var market = q.exchange || q.market || '';
        var name   = q.longname || q.shortname || q.symbol;
        var sector = q.industry || q.sector || '';
        var type   = (sector.toLowerCase().indexOf('bio') !== -1 ||
                      sector.toLowerCase().indexOf('pharma') !== -1 ||
                      sector.toLowerCase().indexOf('medtech') !== -1) ? 'bio' : 'sc';
        var country = (q.symbol.endsWith('.PA')||q.symbol.endsWith('.PA')) ? 'FR'
          : q.symbol.endsWith('.L') ? 'GB'
          : q.symbol.endsWith('.DE') ? 'DE'
          : q.symbol.endsWith('.SW') ? 'CH'
          : q.symbol.endsWith('.AS') ? 'NL'
          : 'US';
        return [name, q.symbol, market, sector, type, country];
      });
  }catch(e){ return []; }
}


function onSearchKey(e){
  const items = document.querySelectorAll('#acList .ac-item');
  if(e.key === 'ArrowDown'){
    e.preventDefault();
    acFocusIdx = Math.min(acFocusIdx + 1, items.length - 1);
    updateAcFocus();
    if(items[acFocusIdx]) items[acFocusIdx].scrollIntoView({block:'nearest'});
  } else if(e.key === 'ArrowUp'){
    e.preventDefault();
    acFocusIdx = Math.max(acFocusIdx - 1, -1);
    updateAcFocus();
    if(acFocusIdx >= 0 && items[acFocusIdx]) items[acFocusIdx].scrollIntoView({block:'nearest'});
  } else if(e.key === 'Enter'){
    if(acFocusIdx >= 0 && items[acFocusIdx]){
      e.preventDefault();
      items[acFocusIdx].click();
    } else {
      hideAC();
      go();
    }
  } else if(e.key === 'Escape'){
    hideAC();
  }
}

// Close autocomplete when clicking outside
document.addEventListener('click', e=>{
  if(!e.target.closest('.search-wrap') && !e.target.closest('#acList')) hideAC();
});


// -- VERSION & DATA MANAGEMENT -----------------------------------------------
var APP_VERSION = '5.0';
var STORAGE_KEYS = { favs: 'ss_favs', port: 'ss_port', key: 'groq_key' };

function updateDataSummary(){
  var el = document.getElementById('data-summary');
  if(!el) return;
  el.textContent = favs.length + ' favori(s), ' + port.length + ' position(s)';
}

function exportData(){
  var data = {
    version: APP_VERSION,
    exported_at: new Date().toISOString(),
    favs: favs,
    port: port
  };
  var blob = new Blob([JSON.stringify(data, null, 2)], {type: 'application/json'});
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = 'stockscore-backup-' + new Date().toISOString().slice(0,10) + '.json';
  a.click();
  URL.revokeObjectURL(url);
  showToast('Données exportées avec succès', 'success');
}

function importData(event){
  var file = event.target.files[0];
  if(!file) return;
  var reader = new FileReader();
  reader.onload = function(e){
    try {
      var data = JSON.parse(e.target.result);
      var importedFavs = data.favs || [];
      var importedPort = data.port || [];

      // Merge: keep existing + add imported ones that don't already exist
      var mergedFavs = favs.slice();
      var mergedPort = port.slice();
      var addedFavs = 0, addedPort = 0;

      importedFavs.forEach(function(f){
        if(!mergedFavs.some(function(x){ return x.company_name === f.company_name; })){
          mergedFavs.push(f);
          addedFavs++;
        }
      });
      importedPort.forEach(function(p){
        if(!mergedPort.some(function(x){ return x.company_name === p.company_name; })){
          mergedPort.push(p);
          addedPort++;
        }
      });

      favs = mergedFavs;
      port = mergedPort;
      save('ss_favs', favs);
      save('ss_port', port);
      updateCounts();
      updateDataSummary();
      renderFavs();
      renderPort();
      showToast('Import OK: +' + addedFavs + ' favori(s), +' + addedPort + ' position(s)', 'success');
    } catch(err) {
      showToast('Erreur import: fichier invalide', 'error');
    }
    event.target.value = '';
  };
  reader.readAsText(file);
}


// ===== RADAR MODULE ==========================================================
var RADAR_CACHE_KEY = 'ss_radar_cache';
var RADAR_CACHE_TTL = 6 * 60 * 60 * 1000; // 6 hours

function initRadar(){
  var cached = getRadarCache();
  if(cached){
    renderRadar(cached.data);
    showRadarLastUpdate(cached.ts);
    document.getElementById('radar-clear-btn').style.display = 'inline-block';
  }
}

function getRadarCache(){
  try{
    var c = JSON.parse(localStorage.getItem(RADAR_CACHE_KEY));
    if(!c) return null;
    if(Date.now() - c.ts > RADAR_CACHE_TTL) return null;
    return c;
  }catch(e){ return null; }
}

function clearRadarCache(){
  localStorage.removeItem(RADAR_CACHE_KEY);
  document.getElementById('radar-sections').style.display = 'none';
  document.getElementById('radar-empty').style.display = 'block';
  document.getElementById('radar-last-update').textContent = '';
  document.getElementById('radar-clear-btn').style.display = 'none';
}

function showRadarLastUpdate(ts){
  var d = new Date(ts);
  document.getElementById('radar-last-update').textContent =
    'Mis a jour le ' + d.toLocaleDateString('fr-FR') +
    ' a ' + d.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'});
}

function buildRadarPrompt(today){
  var schema = '{"generated_at":"DATE","market_context":"Resume 2-3 phrases","signals":{"hausse":[{"name":"Societe","ticker":"TICK.PA","direction":"HAUSSE","horizon":"COURT","confidence":"ELEVE","reason":"Raison","sector":"Secteur"}],"baisse":[{"name":"...","ticker":"...","direction":"BAISSE","horizon":"...","confidence":"...","reason":"...","sector":"..."}],"surveillance":[{"name":"...","ticker":"...","direction":"SURVEILLANCE","horizon":"...","confidence":"...","reason":"...","sector":"...","event":"..."}],"geopolitique":[{"theme":"...","impact":"...","sectors_up":["s1"],"sectors_down":["s2"],"valeurs_up":["NOM (TICK)"],"valeurs_down":["NOM (TICK)"]}]}}';
  schema = schema.replace('DATE', today);
  return "Tu es un analyste financier senior. Nous sommes le " + today + "."
    + " MISSION: Analyser l actualite du jour et identifier les valeurs boursières impactees."
    + " SOURCES: Reuters, Bloomberg, Les Echos, Financial Times, AMF, Fed, BCE, annonces entreprises."
    + " Pour chaque signal: ticker Yahoo Finance, direction HAUSSE/BAISSE/SURVEILLANCE,"
    + " horizon COURT(1-5j)/MOYEN(1-4sem)/LONG(1-3mois), confiance ELEVE/MOYEN/FAIBLE, raison precise."
    + " 4 CATEGORIES: 1.HAUSSE (valeurs qui devraient monter) 2.BAISSE (valeurs sous pression)"
    + " 3.SURVEILLANCE (evenements binaires imminents: resultats, decision FDA, annonce)"
    + " 4.GEOPOLITIQUE (themes macro impactant des secteurs entiers)."
    + " Mix valeurs FR (CAC40, SBF120, Euronext Growth) et internationales. Min 5 signaux par categorie."
    + " Reponds UNIQUEMENT en JSON strict sans texte: " + schema;
}

async function runRadar(){
  var ak = localStorage.getItem('groq_key') || '';
  if(!ak){ showE('Entre ta cle API Groq dans l onglet Analyser.'); switchTab('analyze'); return; }

  document.getElementById('radar-run-btn').disabled = true;
  document.getElementById('radar-loading').classList.add('on');
  document.getElementById('radar-empty').style.display = 'none';
  document.getElementById('radar-sections').style.display = 'none';

  var steps = [
    'Collecte des actualites mondiales...',
    'Analyse geopolitique et macro...',
    'Identification des valeurs impactees...',
    'Calcul des signaux de marche...'
  ];
  var stepIdx = 0;
  var stepInterval = setInterval(function(){
    stepIdx = (stepIdx+1) % steps.length;
    document.getElementById('radar-status').textContent = steps[stepIdx];
  }, 2500);
  try{
    var today = new Date().toLocaleDateString('fr-FR');
    var prompt = buildRadarPrompt(today);
    var raw = await groqFetch(ak,[
      {role:'system',content:'Tu es un analyste financier expert. Tu reponds UNIQUEMENT en JSON valide strict sans markdown.'},
      {role:'user',content:prompt}
    ], 3500);
    var result = parseGroqJSON(raw);
    var ts = Date.now();
    localStorage.setItem(RADAR_CACHE_KEY, JSON.stringify({data:result, ts:ts}));
    renderRadar(result);
    showRadarLastUpdate(ts);
    document.getElementById('radar-clear-btn').style.display = 'inline-block';
  }catch(e){
    document.getElementById('radar-empty').style.display = 'block';
    document.getElementById('radar-empty').textContent = 'Erreur : ' + e.message;
  }finally{
    clearInterval(stepInterval);
    document.getElementById('radar-loading').classList.remove('on');
    document.getElementById('radar-run-btn').disabled = false;
  }
}

function renderRadar(data){
  var sec = document.getElementById('radar-sections');
  sec.innerHTML = '';

  // Market context banner
  if(data.market_context){
    var ctx = document.createElement('div');
    ctx.style.cssText = 'background:var(--info-bg);border:1px solid #B5D4F4;border-radius:10px;padding:12px 16px;font-size:13px;color:#185FA5;line-height:1.6;';
    ctx.innerHTML = '<strong>Contexte de marche :</strong> ' + data.market_context;
    sec.appendChild(ctx);
  }

  var signals = data.signals || {};

  // HAUSSE section
  if(signals.hausse && signals.hausse.length){
    sec.appendChild(buildRadarSection('Signaux HAUSSE', 'up', signals.hausse, false));
  }
  // BAISSE section
  if(signals.baisse && signals.baisse.length){
    sec.appendChild(buildRadarSection('Signaux BAISSE', 'down', signals.baisse, false));
  }
  // SURVEILLANCE section
  if(signals.surveillance && signals.surveillance.length){
    sec.appendChild(buildRadarSection('A surveiller - evenements imminents', 'watch', signals.surveillance, true));
  }
  // GEOPOLITIQUE section
  if(signals.geopolitique && signals.geopolitique.length){
    sec.appendChild(buildGeoSection(signals.geopolitique));
  }

  sec.style.display = 'flex';
  document.getElementById('radar-empty').style.display = 'none';
}

function buildRadarSection(title, cls, items, isWatch){
  var section = document.createElement('div');
  section.className = 'radar-section';
  var header = document.createElement('div');
  header.className = 'radar-sec-title ' + cls;
  header.innerHTML = '<span class="rsig ' + cls + '"></span>' + title + ' (' + items.length + ')';
  section.appendChild(header);

  items.forEach(function(item){
    var row = document.createElement('div');
    row.className = 'radar-item';
    row.title = 'Cliquer pour analyser';

    var confCls = item.confidence==='ELEVE'?'high':item.confidence==='MOYEN'?'med':'low';
    var confLabel = item.confidence==='ELEVE'?'Confiance elevee':item.confidence==='MOYEN'?'Confiance moyenne':'Confiance faible';

    row.innerHTML =
      '<div style="flex:1;">'
        +'<div class="ri-title">' + item.name + ' <span style="font-family:monospace;font-size:11px;color:var(--muted);">' + (item.ticker||'') + '</span></div>'
        +'<div class="ri-reason">' + item.reason + (isWatch && item.event ? ' <strong>Evenement: ' + item.event + '</strong>' : '') + '</div>'
        +'<div class="ri-tags" style="margin-top:5px;">'
          +'<span class="ri-tag ' + cls + '">' + (item.direction||'') + '</span>'
          +'<span class="ri-tag watch">' + (item.horizon||'') + '</span>'
          +'<span style="font-size:10px;color:var(--muted);padding:2px 0;">' + (item.sector||'') + '</span>'
        +'</div>'
      +'</div>'
      +'<div><span class="ri-conf ' + confCls + '">' + confLabel + '</span></div>';

    row.addEventListener('click', function(){
      document.getElementById('cInput').value = item.name;
      switchTab('analyze');
      setTimeout(function(){ go(item.name, null); }, 100);
    });
    section.appendChild(row);
  });
  return section;
}

function buildGeoSection(items){
  var section = document.createElement('div');
  section.className = 'radar-section';
  var header = document.createElement('div');
  header.className = 'radar-sec-title geo';
  header.innerHTML = '<span class="rsig geo"></span>Contexte geopolitique & macro (' + items.length + ' themes)';
  section.appendChild(header);

  items.forEach(function(item){
    var row = document.createElement('div');
    row.className = 'radar-news-item';
    var upV = (item.valeurs_up||[]).join(', ');
    var downV = (item.valeurs_down||[]).join(', ');
    var upS = (item.sectors_up||[]).join(', ');
    var downS = (item.sectors_down||[]).join(', ');
    row.innerHTML =
      '<div class="radar-news-title">' + item.theme + '</div>'
      +'<div class="radar-news-meta" style="line-height:1.7;">' + item.impact
      +(upS?'<br><span style="color:var(--green);font-weight:600;">Secteurs favorises:</span> '+upS:'')
      +(downS?'<br><span style="color:var(--red);font-weight:600;">Secteurs presses:</span> '+downS:'')
      +(upV?'<br><span style="color:var(--green);font-weight:600;">Valeurs a la hausse:</span> '+upV:'')
      +(downV?'<br><span style="color:var(--red);font-weight:600;">Valeurs sous pression:</span> '+downV:'')
      +'</div>';
    section.appendChild(row);
  });
  return section;
}
// =============================================================================

// ===== TOP 10 MODULE =========================================================
var TOP10_CACHE_KEY_BIO = 'ss_top10_bio';
var TOP10_CACHE_KEY_SC  = 'ss_top10_sc';
var TOP10_CACHE_TTL = 12 * 60 * 60 * 1000; // 12h

// Curated candidate lists for Top 10 analysis
var TOP10_BIO_CANDIDATES = [
  'Median Technologies','DBV Technologies','Genfit','Inventiva','Cellectis',
  'Nanobiotix','Innate Pharma','OSE Immunotherapeutics','Transgene','Abivax',
  'Sensorion','Lysogene','Biomerieux','Sartorius Stedim Biotech','Ipsen',
  'Novo Nordisk','Vertex Pharmaceuticals','Regeneron','Moderna','BioNTech'
];
var TOP10_SC_CANDIDATES = [
  'LVMH','Hermes International','Air Liquide','Schneider Electric','Dassault Systemes',
  'Lectra','Esker','Thermador Groupe','Trigano','GTT',
  'Alten','Delta Plus Group','Somfy','ID Logistics','Robertet',
  'Lumibird','Fountaine Pajot','Sidetrade','Groupe Guillin','Catana Group'
];

function getTop10Cache(type){
  try{
    var key = type==='bio' ? TOP10_CACHE_KEY_BIO : TOP10_CACHE_KEY_SC;
    var c = JSON.parse(localStorage.getItem(key));
    if(!c) return null;
    if(Date.now() - c.ts > TOP10_CACHE_TTL) return null;
    return c;
  }catch(e){ return null; }
}

function saveTop10Cache(type, data){
  var key = type==='bio' ? TOP10_CACHE_KEY_BIO : TOP10_CACHE_KEY_SC;
  localStorage.setItem(key, JSON.stringify({data:data, ts:Date.now()}));
}

// ── Candidate lists for Top10 ────────────────────────────────────────────
var TOP10_BIO_CANDIDATES = [
  'Median Technologies','DBV Technologies','Genfit','Transgene','Ose Immunotherapeutics',
  'Inventiva','AB Science','Valneva','Innate Pharma','Voluntis',
  'Novacyt','HalioDx','Carmat','Mauna Kea Technologies','Supersonic Imagine',
  'Guerbet','Eurofins Scientific','bioMerieux','Ipsen','Sanofi',
  'Moderna','BioNTech','Illumina','Exact Sciences','Guardant Health',
  'Intuitive Surgical','DexCom','Insulet','Align Technology','ResMed',
  'Vertex Pharmaceuticals','Regeneron','Biogen','Gilead Sciences','Amgen'
];
var TOP10_SC_CANDIDATES = [
  'Adeunis','Lacroix','Figeac Aero','Actia Group','Clasquin',
  'Linedata','Osmozis','Vente-Unique','Voyageurs du Monde','NRJ Group',
  'Thermador Groupe','Groupe Guillin','Precia','Lisi','Lectra',
  'Dassault Systemes','Teleperformance','Sartorius Stedim','Euronext','Eiffage',
  'Hermès','Kering','LVMH','L Oreal','Schneider Electric',
  'Airbus','Safran','Thales','Naval Group','Arquus'
];

async function loadTop10(type){
  var ak = localStorage.getItem('groq_key')||'';
  if(!ak){ showE('Entre ta cle API Groq et clique Enregistrer.'); return; }

  var btn     = document.getElementById('top10-'+type+'-btn');
  var loading = document.getElementById('top10-'+type+'-loading');
  var content = document.getElementById('top10-'+type+'-content');
  var lastEl  = document.getElementById('top10-'+type+'-last');
  var candidates = type==='bio' ? TOP10_BIO_CANDIDATES : TOP10_SC_CANDIDATES;
  for(var i=0; i<Math.min(candidates.length, 15); i++){
    var co = candidates[i];
    try{
      var typeHint = type==='bio' ? "C'est une biotech/medtech." : "C'est une small cap classique.";
      var facts = type==='bio' ? await fetchBiotechFacts(co) : await fetchScFacts(co);
      var prompt = buildTop10Prompt(co, typeHint, facts, type);  // short prompt saves tokens
      var raw;
      try{
        raw = await groqFetch(ak,[
          {role:'system',content:'Tu es un analyste financier expert. Tu reponds UNIQUEMENT en JSON valide strict sans markdown. Ne mets jamais Non disponible.'},
          {role:'user',content:prompt}
        ], 600);
      }catch(e){ continue; }
      var parsed = parseGroqJSON(raw);
      if(parsed && parsed.total_score){
        results.push({
          name:        co,
          total_score: parsed.total_score,
          max_score:   parsed.max_score||(type==='bio'?35:40),
          verdict:     parsed.verdict||'SURVEILLER',
          sector:      parsed.sector||'',
          upside:      parsed.upside_12m||'',
          timing:      parsed.timing||'',
          // Derive top_positif/negatif from strengths/risks if not present
          top_positif: parsed.top_positif || (parsed.strengths&&parsed.strengths[0])||'',
          top_negatif: parsed.top_negatif || (parsed.risks&&parsed.risks[0])||'',
          dims:        parsed.dimensions ? parsed.dimensions.map(function(d){return{n:d.name,s:d.score};}) : (parsed.dims||[]),
          summary:     parsed.summary||'',
          geopolitique_score: parsed.geopolitique_score||3,
          momentum_score:     parsed.momentum_score||3,
          analyzed_at: new Date().toLocaleDateString('fr-FR')
        });
        // Re-render after each result
        var sorted = results.slice().sort(function(a,b){
          return (b.total_score/b.max_score)-(a.total_score/a.max_score);
        }).slice(0,10);
        renderTop10(type, sorted, false);
      }
    }catch(e){ /* silent - continue with next */ }
    // Small delay to avoid rate limit
    await new Promise(function(res){ setTimeout(res, 800); });
  }

  // Final sort and cache
  var final = results.slice().sort(function(a,b){
    return (b.total_score/b.max_score)-(a.total_score/a.max_score);
  }).slice(0,10);

  saveTop10Cache(type, final);
  renderTop10(type, final, true);
  loading.classList.remove('on');
  btn.disabled = false;
}

function buildTop10Prompt(co, typeHint, facts, type){
  var isBio = type === 'bio';
  var maxScore = isBio ? 35 : 40;
  var factsBlock = facts && facts.length > 10 ? '\nDONNEES TEMPS REEL:\n' + facts.slice(0,1000) + '\n' : '';
  var dims = isBio
    ? '7 dims /5 (total/35): 1.Tech 2.FDA/CE(510k=5pts) 3.Remboursement 4.Marche 5.Tresorerie 6.Equipe 7.Valorisation'
    : '8 dims /5 (total/40): 1.BusinessModel 2.FinancierFCF(>0=4pts) 3.Croissance 4.Management 5.Moat 6.Valorisation 7.Liquidite 8.Risques';
  var geoContext = window._geoContext
    ? '\nCONTEXTE GEOPOLITIQUE ACTUEL: ' + window._geoContext + '\n'
    : '';
  return 'Analyste financier. Nous sommes en mars 2026. Entreprise: ' + co + '. ' + typeHint
    + factsBlock + geoContext
    + '\nSCORECARD: ' + dims
    + '\ngeopolitique_score 1-5: impact des tensions mondiales actuelles sur cette entreprise (5=tres favorable, 1=tres negatif)'
    + '\nJSON UNIQUEMENT: {"total_score":0,"max_score":' + maxScore + ',"verdict":"INVESTISSABLE ou SURVEILLER ou EVITER",'
    + '"sector":"","upside_12m":"+X%","timing":"MAINTENANT ou ATTENDRE ou EVITER",'
    + '"geopolitique_score":3,"geopolitique_note":"impact tensions mondiales en 1 phrase",'
    + '"top_positif":"atout 5 mots","top_negatif":"risque 5 mots","dims":[{"n":"nom","s":3}]}';
}

function scoreCol(s,max){ var r=s/max; return r>=.75?'#3B6D11':r>=.55?'#BA7517':'#A32D2D'; }

function renderTop10(type, data, isFinal){
  var content = document.getElementById('top10-'+type+'-content');
  var lastEl  = document.getElementById('top10-'+type+'-last');
  if(!data || !data.length){
    content.innerHTML = '<div class="top10-empty">Aucune donnee</div>';
    return;
  }
  var html = '<div class="top10-list">';
  data.forEach(function(item, idx){
    var ratio = item.total_score/item.max_score;
    var col = scoreCol(item.total_score, item.max_score);
    var vc = item.verdict==='INVESTISSABLE'?'inv':item.verdict==='SURVEILLER'?'surv':'evit';
    var vl = item.verdict==='INVESTISSABLE'?'BUY':item.verdict==='SURVEILLER'?'HOLD':'SELL';
    var tim = item.timing||''; var timCls = tim==='MAINTENANT'?'inv':tim==='EVITER'?'evit':'surv'; var timTxt = tim==='MAINTENANT'?'Maintenant':tim==='TROP_TARD'?'Trop tard':tim==='EVITER'?'Eviter':tim==='ATTENDRE'?'Attendre':'';

    // Dims mini-bars (top 4 sorted by score desc for space)
    var dimsHtml = '';
    if(item.dims && item.dims.length){
      var sorted = item.dims.slice().sort(function(a,b){return b.s-a.s;});
      var top = sorted.slice(0,2);
      var bot = sorted.slice(-2).reverse();
      dimsHtml = '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:4px;">';
      top.forEach(function(d){
        var c = scoreCol(d.s,5);
        dimsHtml += '<span style="font-size:10px;color:'+c+';background:'+c+'18;padding:1px 5px;border-radius:3px;font-weight:600;">'+d.n+' '+d.s+'/5</span>';
      });
      bot.forEach(function(d){
        var c = scoreCol(d.s,5);
        dimsHtml += '<span style="font-size:10px;color:'+c+';background:'+c+'18;padding:1px 5px;border-radius:3px;font-weight:600;">'+d.n+' '+d.s+'/5</span>';
      });
      dimsHtml += '</div>';
    }

    // Positif / negatif tags
    var tagsHtml = '';
    if(item.top_positif || item.top_negatif){
      tagsHtml = '<div style="display:flex;gap:5px;margin-top:3px;flex-wrap:wrap;">';
      if(item.top_positif) tagsHtml += '<span style="font-size:10px;color:#3B6D11;background:#EAF3DE;padding:1px 5px;border-radius:3px;">+ '+item.top_positif+'</span>';
      if(item.top_negatif) tagsHtml += '<span style="font-size:10px;color:#A32D2D;background:#FCEBEB;padding:1px 5px;border-radius:3px;">- '+item.top_negatif+'</span>';
      tagsHtml += '</div>';
    }

    html += '<div class="top10-row" style="flex-direction:column;align-items:stretch;" onclick="launchAnalysis('+JSON.stringify(item.name)+')">'
      +'<div style="display:flex;align-items:center;gap:9px;">'
        +'<span class="top10-rank">'+(idx+1)+'</span>'
        +'<span class="top10-name" title="'+item.name+'">'+item.name+'</span>'
        +'<span style="font-size:10px;color:var(--muted);flex-shrink:0;">'+item.sector+'</span>'
        +'<span class="top10-score" style="color:'+col+';flex-shrink:0;">'+item.total_score+'/'+item.max_score+'</span>'
        +'<span class="top10-verdict '+vc+'" style="flex-shrink:0;">'+vl+'</span>'
        +(item.upside?'<span style="font-size:10px;font-weight:700;color:'+(item.upside.startsWith('-')?'#A32D2D':'#3B6D11')+';flex-shrink:0;">'+item.upside+'</span>':'')
      +'</div>'
      +tagsHtml
      +dimsHtml
      +'</div>';
  });
  html += '</div>';
  content.innerHTML = html;

  if(isFinal){
    lastEl.style.display = 'block';
    lastEl.textContent = 'Analyse flash · score estimatif · cliquer pour analyse complete';
  }
}

function launchAnalysis(name){
  document.getElementById('cInput').value = name;
  document.getElementById('res').classList.remove('on');
  go(name, null);
}

// Load Top 10 from cache on init if available
function initTop10(){
  ['bio','sc'].forEach(function(type){
    var cached = getTop10Cache(type);
    if(cached && cached.data && cached.data.length){
      renderTop10(type, cached.data, true);
    }
  });
}
// =============================================================================

// ===== ROADMAP + DATES CLES =================================================

var BIOTECH_STEPS = [
  {id:'concept',  label:'Recherche',     desc:'Fondamentale'},
  {id:'preclin',  label:'Preclinique',   desc:'In vitro / vivo'},
  {id:'phase1',   label:'Phase I',       desc:'Securite'},
  {id:'phase2',   label:'Phase II',      desc:'Efficacite'},
  {id:'phase3',   label:'Phase III',     desc:'Pivotale'},
  {id:'approval', label:'Autorisation',  desc:'FDA / CE'},
  {id:'reimb',    label:'Remboursement', desc:'HAS / CMS'},
  {id:'market',   label:'Commercial',    desc:'Revenus recurrents'}
];

var SC_STEPS = [
  {id:'startup',  label:'Création',      desc:'< 5 ans'},
  {id:'growth',   label:'Croissance',    desc:'CA > 15%/an'},
  {id:'profit',   label:'Rentabilité',   desc:'FCF positif'},
  {id:'scale',    label:'Expansion',     desc:'International'},
  {id:'mature',   label:'Maturité',      desc:'Dividende stable'},
  {id:'leader',   label:'Leadership',    desc:'Niche dominée'}
];

var LARGE_STEPS = [
  {id:'growth',   label:'Croissance',    desc:'CAGR > 8%'},
  {id:'moat',     label:'Moat',          desc:'Avantage durable'},
  {id:'profit',   label:'Rentabilité',   desc:'FCF & marges'},
  {id:'dividend', label:'Dividende',     desc:'Versement stable'},
  {id:'buyback',  label:'Rachats',       desc:'Capital retourné'},
  {id:'leader',   label:'Leadership',    desc:'Position dominante'}
];

function detectStep(r, rtData){
  var f    = (rtData && rtData.fundamentals) || {};
  var sc   = r.smallcap_checklist  || {};
  var bc   = r.biotech_checklist   || {};
  var type = selT || 'sc';
  var dims = r.dimensions || [];
  function getDim(kw){ var d=dims.find(function(x){return x.name&&x.name.toLowerCase().indexOf(kw)!==-1;}); return d?d.score:null; }

  // Enrich missing Yahoo data from IA checklist + dims
  if(f.fcf === null || f.fcf === undefined){
    if(sc.fcf_positif==='oui') f = Object.assign({},f,{fcf:1e6});
    else if(sc.fcf_positif==='non') f = Object.assign({},f,{fcf:-1e6});
  }
  if(!f.divYield && !f.divRate){
    if(sc.dividende_croissant==='oui') f = Object.assign({},f,{divRate:1});
  }
  if(!f.roe){
    var finDim = getDim('financ')||getDim('sant');
    if(finDim) f = Object.assign({},f,{roe: finDim>=4?0.20:finDim===3?0.10:0.05});
  }
  if(!f.revenueGrowth){
    var growDim = getDim('crois')||getDim('growth');
    if(growDim) f = Object.assign({},f,{revenueGrowth: growDim>=4?0.20:growDim===3?0.10:0.05});
  }
  // Parse marketCap from text if Yahoo missing
  if(!f.marketCap && r.market_cap){
    var mcTxt = (r.market_cap||'').replace(/\s/g,'').toLowerCase();
    var mcNum = parseFloat(mcTxt);
    if(!isNaN(mcNum)){
      if(mcTxt.indexOf('md')!==-1||mcTxt.indexOf('b')!==-1) f=Object.assign({},f,{marketCap:mcNum*1e9});
      else if(mcTxt.indexOf('m')!==-1) f=Object.assign({},f,{marketCap:mcNum*1e6});
    }
  }

  if(type === 'bio'){
    // Biotech: derive from checklist + pipeline
    if(bc.fda_obtenu === 'oui' || bc.marquage_ce === 'oui'){
      if(bc.revenus_recurrents === 'oui') return 'market';
      if(bc.remboursement_etabli === 'oui' || bc.remboursement_etabli === 'en_cours') return 'reimb';
      return 'approval';
    }
    var phases = [];
    (r.pipeline||[]).forEach(function(p){ if(p.phase&&p.status!=='Abandonne') phases.push(p.phase); });
    ((rtData&&rtData.trials)||[]).forEach(function(t){ if(t.phase) phases.push(t.phase); });
    if(phases.some(function(p){return p==='Phase III'||p==='Soumis';})) return 'phase3';
    if(phases.some(function(p){return p==='Phase II';})) return 'phase2';
    if(phases.some(function(p){return p==='Phase I';}))  return 'phase1';
    if(bc.is_startup==='non') return 'preclin';
    return 'concept';
  }

  if(type === 'large'){
    // Large Cap: derive from financial data
    var cap = f.marketCap || 0;
    var fcf = f.fcf;
    var div = f.divYield || f.divRate;
    var rg  = f.revenueGrowth;
    var roe = f.roe;
    // Leader: profitable, dividend, strong moat signals
    if(div && div > 0 && fcf && fcf > 0 && roe && roe > 0.15) return 'leader';
    // Buyback proxy: high ROE + FCF + low growth (mature)
    if(fcf && fcf > 0 && roe && roe > 0.12 && (!rg || rg < 0.10)) return 'buyback';
    // Dividend: FCF positive + dividend initiated
    if(div && div > 0 && fcf && fcf > 0) return 'dividend';
    // Profit: FCF positive, margins stable
    if(fcf && fcf > 0) return 'profit';
    // Moat: established company, revenue but FCF not yet consistent
    if(f.revenue && f.revenue > 1e9) return 'moat';
    return 'growth';
  }

  // Small Cap
  var fcfSC = f.fcf || (sc.fcf_positif === 'oui' ? 1 : sc.fcf_positif === 'non' ? -1 : 0);
  var divSC = f.divYield || f.divRate;
  var capSC = f.marketCap || 0;
  var rgSC  = f.revenueGrowth;
  if(divSC && divSC > 0 && fcfSC > 0) return 'mature';
  if(fcfSC > 0 && capSC > 300e6)       return 'scale';
  if(fcfSC > 0)                         return 'profit';
  if(rgSC && rgSC > 0.15)               return 'growth';
  return 'startup';
}

function renderRoadmap(r){
  var sec       = document.getElementById('roadmap-section');
  var container = document.getElementById('roadmap-container');
  if(!sec || !container){ return; }
  sec.style.display = 'block';

  var type    = selT || 'sc';
  var isBio   = type === 'bio';
  var steps   = isBio ? BIOTECH_STEPS : (type === 'large' ? LARGE_STEPS : SC_STEPS);

  // Compute step from real data — ignore Groq's r.roadmap.current_step
  var currentId = detectStep(r, window._rtData || {});
  var stepIds   = steps.map(function(s){ return s.id; });
  var currentPos = stepIds.indexOf(currentId);
  if(currentPos === -1) currentPos = 0;

  // Analysis text: use Groq's if available, else generate
  var analysisText = (r.roadmap && r.roadmap.analysis) || '';

  var html = '<div class="roadmap"><div class="roadmap-track">';
  steps.forEach(function(step, i){
    var isDone    = i < currentPos;
    var isCurrent = i === currentPos;
    var cls  = isDone ? 'done' : isCurrent ? 'current' : 'next';
    var icon = isDone ? 'V' : String(i + 1);
    html += '<div class="roadmap-step">';
    html += '<div class="roadmap-step-circle ' + cls + '">';
    if(isCurrent) html += '<div class="roadmap-arrow">&#9660;</div>';
    html += icon + '</div>';
    html += '<div class="roadmap-step-label ' + cls + '">' + step.label
          + '<br><span style="font-weight:400;font-size:9px;">' + step.desc + '</span></div>';
    html += '</div>';
    if(i < steps.length - 1){
      html += '<div class="roadmap-connector ' + (i < currentPos ? 'done' : 'next') + '"></div>';
    }
  });
  html += '</div></div>';
  if(analysisText){
    html += '<div style="font-size:12px;color:var(--muted);padding:6px 18px 10px;line-height:1.6;">'
          + analysisText + '</div>';
  }
  container.innerHTML = html;
}


function renderDates(r){
  var sec = document.getElementById('dates-section');
  var container = document.getElementById('dates-container');
  if(!r || !r.key_dates || !r.key_dates.length){ sec.style.display = 'none'; return; }
  sec.style.display = 'block';

  var now = new Date();
  var html = '<div class="dates-list">';
  r.key_dates.forEach(function(d){
    var dateStr = d.date || '';
    var daysDiff = 999;
    if(dateStr){
      var parts = dateStr.split('/');
      if(parts.length === 3){
        var dt = new Date(parts[2]+'-'+parts[1]+'-'+parts[0]);
        daysDiff = Math.round((dt - now) / (1000*3600*24));
      }
    }
    var badgeCls = daysDiff <= 30 ? 'soon' : daysDiff <= 90 ? 'upcoming' : 'later';
    var badgeTxt = daysDiff <= 30 ? 'Imminent' : daysDiff <= 90 ? 'Proche' : 'A venir';
    if(daysDiff < 0){ badgeCls = 'later'; badgeTxt = 'Passe'; }

    html += '<div class="date-item">'
      +'<div>'
        +'<span class="date-badge '+badgeCls+'">'+badgeTxt+'</span>'
        +(dateStr?'<div style="font-size:10px;color:var(--muted);margin-top:2px;">'+dateStr+'</div>':'')
      +'</div>'
      +'<div>'
        +'<div class="date-title">'+d.title+'</div>'
        +'<div class="date-detail">'+d.detail+'</div>'
      +'</div>'
      +'</div>';
  });
  html += '</div>';
  container.innerHTML = html;
}

// ── Static guide for Guide tab ────────────────────────────────────────────
var guideInitDone = false;

// ===== GEO ENGINE ============================================================
var GEO_CACHE_KEY = 'ss_geo_v2';
var GEO_TTL = 4*3600*1000;
var _geoReady = false;

var GEO_INDICES = [
  {id:'idx-SPX',  t:'^GSPC',     n:'S&P 500'},
  {id:'idx-CAC',  t:'^FCHI',     n:'CAC 40'},
  {id:'idx-DAX',  t:'^GDAXI',    n:'DAX'},
  {id:'idx-SX5E', t:'^STOXX50E', n:'STOXX 50'},
  {id:'idx-FTSE', t:'^FTSE',     n:'FTSE 100'},
  {id:'idx-NK',   t:'^N225',     n:'Nikkei'},
  {id:'idx-HSI',  t:'^HSI',      n:'Hang Seng'},
  {id:'idx-GOLD', t:'GC=F',      n:'Or'},
  {id:'idx-OIL',  t:'CL=F',      n:'WTI'},
  {id:'idx-DXY',  t:'DX-Y.NYB',  n:'USD DXY'}
];

function initGeo(){
  // Build index cards if not already built
  var grid = document.getElementById('geo-indices');
  if(grid && !grid.innerHTML.trim()){
    GEO_INDICES.forEach(function(idx){
      var d = document.createElement('div');
      d.className = 'geo-idx';
      d.id = idx.id;
      d.innerHTML = '<div class="geo-idx-name">'+idx.n+'</div>'
        +'<div class="geo-idx-val">--</div>'
        +'<div class="geo-idx-chg neu">--</div>';
      grid.appendChild(d);
    });
  }
  // Fetch indices (always fresh)
  geoFetchIndices();
  // Check cache
  try{
    var c = JSON.parse(localStorage.getItem(GEO_CACHE_KEY)||'null');
    if(c && c.ts && (Date.now()-c.ts)<GEO_TTL && c.data){
      geoRender(c.data);
      document.getElementById('geo-ts').textContent =
        'Mis à jour '+new Date(c.ts).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'});
    }
  }catch(e){}
}

function geoFetchIndices(){
  var proxies = ['https://api.allorigins.win/raw?url=','https://corsproxy.io/?'];
  GEO_INDICES.forEach(function(idx){
    var url = 'https://query1.finance.yahoo.com/v8/finance/chart/'
      +encodeURIComponent(idx.t)+'?interval=1d&range=5d';
    (function(index){
      var tried = 0;
      function tryProxy(pi){
        if(pi>=proxies.length) return;
        fetch(proxies[pi]+encodeURIComponent(url),{signal:AbortSignal.timeout(7000)})
          .then(function(r){ return r.ok ? r.text() : Promise.reject(); })
          .then(function(txt){
            if(txt.startsWith('{"contents"')){try{var w=JSON.parse(txt);txt=w.contents||txt;}catch(e){}}
            var d=JSON.parse(txt);
            var res=d&&d.chart&&d.chart.result&&d.chart.result[0];
            if(!res) throw new Error('no result');
            var meta=res.meta||{};
            var price=meta.regularMarketPrice;
            var prev=meta.previousClose||meta.chartPreviousClose||price;
            if(!price) throw new Error('no price');
            var chg=prev?(price-prev)/prev*100:0;
            var card=document.getElementById(index.id);
            if(!card) return;
            card.querySelector('.geo-idx-val').textContent=price.toLocaleString('fr-FR',{maximumFractionDigits:2});
            var el=card.querySelector('.geo-idx-chg');
            el.textContent=(chg>=0?'+':'')+chg.toFixed(2)+'%';
            el.className='geo-idx-chg '+(chg>0.05?'pos':chg<-0.05?'neg':'neu');
          })
          .catch(function(){ tryProxy(pi+1); });
      }
      tryProxy(0);
    })(idx);
  });
}

function geoBuildPrompt(){
  var today = new Date().toLocaleDateString('fr-FR',{weekday:'long',year:'numeric',month:'long',day:'numeric'});
  return 'Tu es stratégiste géopolitique et financier senior. Nous sommes le '+today+'.'
    +'\nMISSION: Analyse l\'actualité géopolitique mondiale des 72 dernières heures et son impact sur les marchés.'
    +'\nCouverture: Ukraine/OTAN, Chine-Taiwan, Moyen-Orient, politique Fed/BCE, matières premières, tech guerre froide.'
    +'\nRéponds UNIQUEMENT en JSON strict sans markdown:'
    +'\n{"summary":"contexte global 2-3 phrases",'
    +'"tensions":[{"zone":"nom zone","score":7,"trend":"hausse|stable|baisse","themes":["theme1"],"detail":"1 phrase"}],'
    +'"sectors":[{"name":"secteur","impact":"pos|neg|neu","score":7,"reason":"raison courte","tickers":["T1","T2"]}],'
    +'"scenarios":[{"name":"nom","prob":55,"type":"base|bear|bull","desc":"description","market":"impact marché"}],'
    +'"opps":[{"ticker":"T","name":"Nom","reason":"raison","conv":"Haute|Moyenne"}],'
    +'"risks":[{"ticker":"T","name":"Nom","reason":"raison"}],'
    +'"stocks":[{"ticker":"T","name":"Nom","dir":"hausse|baisse|risque","reason":"raison","conv":8}],'
    +'"reasoning":"raisonnement complet 4-5 phrases"}';
}

async function runGeo(){
  var ak=localStorage.getItem('groq_key')||'';
  if(!ak){ showToast('Entre ta clé Groq dans les paramètres','success'); switchTab('analyze'); return; }
  var btn=document.getElementById('geo-btn');
  var placeholder=document.getElementById('geo-placeholder');
  if(placeholder) placeholder.style.display='none';
  var loading=document.getElementById('geo-loading');
  var empty=document.getElementById('geo-empty');
  var gcontent=document.getElementById('geo-content');
  btn.disabled=true;
  loading.style.display='block';
  empty.style.display='none';
  gcontent.style.display='none';
  var steps=['Collecte actualités mondiales...','Analyse tensions géopolitiques...','Modélisation impact marchés...','Génération scénarios...'];
  var si=0;
  var iv=setInterval(function(){ si=(si+1)%steps.length; document.getElementById('geo-step').textContent=steps[si]; },2000);
  try{
    var raw=await groqFetch(ak,[
      {role:'system',content:'Tu es un expert géopolitique et financier. Réponds UNIQUEMENT en JSON valide strict sans markdown.'},
      {role:'user',content:geoBuildPrompt()}
    ],3500);
    var data=parseGroqJSON(raw);
    if(!data||!data.tensions) throw new Error('Réponse invalide du modèle');
    window._geoContext=data.summary||'';
    localStorage.setItem(GEO_CACHE_KEY,JSON.stringify({data:data,ts:Date.now()}));
    geoRender(data);
    document.getElementById('geo-ts').textContent='Mis à jour '+new Date().toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'});
  }catch(e){
    loading.style.display='none';
    empty.style.display='block';
    empty.innerHTML='<span style="color:var(--red)">Erreur : '+e.message+'</span><br><button onclick="runGeo()" style="margin-top:10px;padding:6px 14px;background:var(--accent);color:#fff;border:none;border-radius:6px;cursor:pointer;font-weight:700;">Réessayer</button>';
  }finally{
    clearInterval(iv);
    loading.style.display='none';
    btn.disabled=false;
  }
}

function geoRender(data){
  document.getElementById('geo-empty').style.display='none';
  document.getElementById('geo-content').style.display='block';

  // Summary
  document.getElementById('geo-summary').textContent=data.summary||'';

  // Tensions
  var tc=document.getElementById('geo-tensions');
  tc.innerHTML='';
  (data.tensions||[]).forEach(function(t){
    var s=t.score||5;
    var col=s>=8?'#A32D2D':s>=6?'#854F0B':s>=4?'#BA7517':'#3B6D11';
    var trend=t.trend==='hausse'?'↑ ':t.trend==='baisse'?'↓ ':'→ ';
    var trendCol=t.trend==='hausse'?'var(--red)':t.trend==='baisse'?'var(--green)':'var(--muted)';
    var row=document.createElement('div');
    row.className='geo-tension';
    row.innerHTML='<div class="geo-tz">'+t.zone+'</div>'
      +'<div class="geo-bar"><div class="geo-bar-fill" style="width:'+s*10+'%;background:'+col+'"></div></div>'
      +'<div class="geo-ts" style="color:'+col+'">'+s+'/10</div>'
      +'<div class="geo-trend" style="color:'+trendCol+'">'+trend+'</div>'
      +'<div class="geo-themes">'+(t.themes||[]).join(' · ')+'</div>';
    tc.appendChild(row);
    if(t.detail){
      var detail=document.createElement('div');
      detail.style.cssText='font-size:11px;color:var(--muted);padding-left:162px;margin-top:-2px;margin-bottom:2px;';
      detail.textContent=t.detail;
      tc.appendChild(detail);
    }
  });

  // Sectors
  var sc=document.getElementById('geo-sectors');
  sc.innerHTML='';
  (data.sectors||[]).forEach(function(s){
    var col=s.impact==='pos'?'var(--green)':s.impact==='neg'?'var(--red)':'var(--amber)';
    var icon=s.impact==='pos'?'↑':s.impact==='neg'?'↓':'→';
    var div=document.createElement('div');
    div.className='geo-sect';
    div.style.borderLeft='3px solid '+(s.impact==='pos'?'var(--green)':s.impact==='neg'?'var(--red)':'var(--amber)');
    div.innerHTML='<div style="display:flex;justify-content:space-between;">'
      +'<div class="geo-sect-name">'+s.name+'</div>'
      +'<span style="font-size:13px;font-weight:700;color:'+col+'">'+icon+' '+s.score+'/10</span>'
      +'</div>'
      +'<div class="geo-sect-reason">'+s.reason+'</div>';
    if(s.tickers&&s.tickers.length){
      var pills=document.createElement('div');
      pills.className='geo-sect-tickers';
      s.tickers.forEach(function(tk){
        var span=document.createElement('span');
        span.className='geo-ticker';
        span.textContent=tk;
        span.dataset.ticker=tk;
        pills.appendChild(span);
      });
      div.appendChild(pills);
    }
    sc.appendChild(div);
  });

  // Scenarios
  var scn=document.getElementById('geo-scenarios');
  scn.innerHTML='';
  (data.scenarios||[]).forEach(function(s){
    var div=document.createElement('div');
    div.className='geo-scenario';
    div.innerHTML='<div class="geo-prob '+s.type+'">'+s.prob+'%</div>'
      +'<div><div style="font-size:12px;font-weight:700;margin-bottom:3px;">'+s.name+'</div>'
      +'<div style="font-size:11px;color:var(--muted);">'+s.desc+'</div>'
      +'<div style="font-size:11px;font-weight:600;margin-top:3px;">'+s.market+'</div></div>';
    scn.appendChild(div);
  });

  // Opps
  var oc=document.getElementById('geo-opps');
  oc.innerHTML='<div style="font-size:11px;font-weight:700;color:var(--green);margin-bottom:8px;">OPPORTUNITÉS</div>';
  (data.opps||[]).forEach(function(o){
    var div=document.createElement('div');
    div.className='geo-item';
    div.dataset.ticker=o.ticker||'';
    div.innerHTML='<div><div style="font-size:12px;font-weight:700;color:var(--green);">'+o.name+'</div>'
      +'<div style="font-size:10px;font-family:monospace;color:var(--muted);">'+o.ticker+'</div></div>'
      +'<div style="flex:1;font-size:11px;color:var(--muted);">'+o.reason+'</div>'
      +'<span style="font-size:10px;font-weight:700;color:var(--green);white-space:nowrap;">'+o.conv+'</span>';
    oc.appendChild(div);
  });

  // Risks
  var rc=document.getElementById('geo-risks');
  rc.innerHTML='<div style="font-size:11px;font-weight:700;color:var(--red);margin-bottom:8px;">RISQUES</div>';
  (data.risks||[]).forEach(function(r){
    var div=document.createElement('div');
    div.className='geo-item';
    div.dataset.ticker=r.ticker||'';
    div.innerHTML='<div><div style="font-size:12px;font-weight:700;color:var(--red);">'+r.name+'</div>'
      +'<div style="font-size:10px;font-family:monospace;color:var(--muted);">'+r.ticker+'</div></div>'
      +'<div style="flex:1;font-size:11px;color:var(--muted);">'+r.reason+'</div>';
    rc.appendChild(div);
  });

  // Stocks
  var stc=document.getElementById('geo-stocks');
  stc.innerHTML='';
  (data.stocks||[]).forEach(function(s){
    var col=s.dir==='hausse'?'var(--green)':s.dir==='baisse'?'var(--red)':'var(--amber)';
    var icon=s.dir==='hausse'?'↑':s.dir==='baisse'?'↓':'⚠';
    var div=document.createElement('div');
    div.className='geo-stock';
    div.dataset.ticker=s.ticker||'';
    var dots='';
    for(var i=0;i<Math.min(s.conv||5,10);i++) dots+='<div style="width:5px;height:5px;border-radius:50%;background:'+col+';display:inline-block;margin:0 1px;"></div>';
    div.innerHTML='<span style="font-size:18px;color:'+col+';width:22px;text-align:center;">'+icon+'</span>'
      +'<div style="flex:1;">'
        +'<span style="font-size:12px;font-weight:700;">'+s.name+'</span>'
        +' <span style="font-size:10px;font-family:monospace;color:var(--muted);">'+s.ticker+'</span><br>'
        +'<span style="font-size:11px;color:var(--muted);">'+s.reason+'</span>'
      +'</div>'
      +'<div style="text-align:right;">'
        +'<div style="font-size:10px;font-weight:700;color:'+col+';">'+s.dir.toUpperCase()+'</div>'
        +'<div>'+dots+'</div>'
      +'</div>';
    stc.appendChild(div);
  });

  // Reasoning
  document.getElementById('geo-reasoning').textContent=data.reasoning||'';

  // Event delegation for all clickable tickers
  var panel=document.getElementById('panel-geo');
  if(!panel._geoListener){
    panel._geoListener=true;
    panel.addEventListener('click',function(e){
      var el=e.target.closest('[data-ticker]');
      if(el){
        var tk=el.getAttribute('data-ticker');
        if(tk&&tk.length>0){
          var inp=document.getElementById('cInput');
          if(inp) inp.value=tk;
          switchTab('analyze');
          setTimeout(function(){ go(tk); },150);
        }
      }
    });
  }
}
// =============================================================================

function initGuide(){
  if(guideInitDone) return;
  guideInitDone = true;

  var bioSteps = [
    {label:'1. Recherche fondamentale', desc:'Technologie differentielle, IP, donnees precliniques solides. Duree: 2-5 ans.'},
    {label:'2. Essais precliniques', desc:'Validation in vitro et in vivo. Premier signal defficacite. Financement seed/serie A.'},
    {label:'3. Phase I', desc:'Securite et dosage. 20-80 patients sains. Taux echec: 30%. Duree: 1-2 ans.'},
    {label:'4. Phase II', desc:'Efficacite et effets secondaires. 100-300 patients. Etape critique pour levees de fonds.'},
    {label:'5. Phase III', desc:'Essai pivotal grande echelle. 300-3000 patients. Cout elevé. Catalyseur majeur de valorisation.'},
    {label:'6. Autorisation FDA / CE', desc:'Soumission 510k, PMA ou NDA. Delai 6-18 mois. Approbation = saut de valorisation majeur.'},
    {label:'7. Remboursement', desc:'Negociations HAS (FR), NICE (UK), CMS (US). Sans remboursement: adoption limitee.'},
    {label:'8. Commercialisation', desc:'Revenus recurrents, force de vente, expansion geographique. Rentabilite operationnelle.'}
  ];

  var scSteps = [
    {label:'1. Business model viable', desc:'Revenus recurrents >50% CA. Pricing power. Client unique <20% CA. Barriere entree.'},
    {label:'2. Sante financiere', desc:'FCF positif. Dette nette/EBITDA <2x. Current ratio >1. Marges en amelioration.'},
    {label:'3. Croissance organique', desc:'CAGR CA >8% sur 3 ans. Backlog visible. Pas de croissance uniquement par acquisitions.'},
    {label:'4. Management aligne', desc:'Dirigeant actionnaire >5%. Aucun profit warning recents. Track record tenu. Incentives LT.'},
    {label:'5. Avantage concurrentiel', desc:'Moat identifiable: marque, brevets, switching costs, effets reseau, economies echelle.'},
    {label:'6. Valorisation raisonnable', desc:'PER < moyenne sectorielle ou croissance justifie prime. FCF yield >4%. EV/EBITDA <12x.'}
  ];

  var bioHtml = '<div class="guide-steps">';
  bioSteps.forEach(function(s){
    bioHtml += '<div class="guide-step bio"><div class="guide-step-title">'+s.label+'</div><div class="guide-step-desc">'+s.desc+'</div></div>';
  });
  bioHtml += '</div>';

  var scHtml = '<div class="guide-steps">';
  scSteps.forEach(function(s){
    scHtml += '<div class="guide-step sc"><div class="guide-step-title">'+s.label+'</div><div class="guide-step-desc">'+s.desc+'</div></div>';
  });
  scHtml += '</div>';

  var bioCont = document.getElementById('guide-bio-chart');
  var scCont  = document.getElementById('guide-sc-chart');
  if(bioCont) bioCont.innerHTML = bioHtml;
  if(scCont)  scCont.innerHTML  = scHtml;
}
// =============================================================================

// -- EVENT DELEGATION for port and favs cards --------------------------------
// This avoids all onclick/JSON.stringify issues in innerHTML

document.addEventListener('DOMContentLoaded', function(){
  // Portfolio grid delegation
  var portGrid = document.getElementById('port-grid');
  if(portGrid){
    portGrid.addEventListener('click', function(e){
      var btn = e.target.closest('button[data-action]');
      if(!btn) return;
      var card = btn.closest('[data-name]');
      if(!card) return;
      var name = card.dataset.name;
      var safe = card.dataset.safe;
      if(btn.dataset.action === 'del'){
        removePort(name);
      } else if(btn.dataset.action === 'update'){
        reanalyzePort(name, safe);
      }
    });
  }

  // Favs grid delegation
  var favsGrid = document.getElementById('favs-grid');
  if(favsGrid){
    favsGrid.addEventListener('click', function(e){
      var btn = e.target.closest('button[data-action]');
      if(!btn) return;
      var card = btn.closest('[data-name]');
      if(!card) return;
      var name = card.dataset.name;
      var safe = card.dataset.safe;
      if(btn.dataset.action === 'del'){
        removeFav(name);
      } else if(btn.dataset.action === 'update'){
        reanalyzeFav(name, safe);
      }
    });
  }
});



// ===== BIOTECH RADAR =======================================================
var BIGPHARMA = [
  'Pfizer','Roche','Novartis','Johnson','Merck','AstraZeneca','AbbVie',
  'Sanofi','GlaxoSmithKline','GSK','Bristol','BMS','Eli Lilly','Lilly',
  'Amgen','Gilead','Regeneron','Biogen','Boehringer','Bayer','Novo Nordisk',
  'Takeda','Astellas','Daiichi','UCB','Ipsen','Servier','Pierre Fabre',
  'Moderna','BioNTech','Vertex','Alexion','AbbVie','Celgene','Genentech',
  'MSD','Janssen','Genzyme','Shire','Allergan','Eisai','Otsuka'
];

var _screenData   = [];
var _screenSort   = {col:'name', asc:true};
var _screenCache  = null;
var _screenCacheTs = 0;
var SCREEN_TTL    = 3600000; // 1h cache

function initScreen(){
  // Restore from cache if fresh
  try{
    var c = JSON.parse(localStorage.getItem('ss_screen_cache')||'null');
    if(c && c.ts && (Date.now()-c.ts)<SCREEN_TTL && c.data && c.data.length){
      _screenData = c.data;
      renderScreenResults();
      document.getElementById('screen-empty').style.display='none';
      return;
    }
  }catch(e){}
}

async function runScreen(){
  var btn     = document.getElementById('screen-btn');
  var loading = document.getElementById('screen-loading');
  var empty   = document.getElementById('screen-empty');
  var results = document.getElementById('screen-results');
  var stats   = document.getElementById('screen-stats');
  var stepEl  = document.getElementById('screen-step');

  btn.disabled = true;
  loading.style.display = 'block';
  empty.style.display   = 'none';
  results.style.display = 'none';
  if(stats) stats.style.display = 'none';
  _screenData = [];

  function setStep(msg){ if(stepEl) stepEl.textContent = msg; }
  function showErr(msg){
    loading.style.display = 'none';
    empty.style.display   = 'block';
    empty.innerHTML = '<div style="color:var(--red);font-weight:700;margin-bottom:10px;">⚠ '+msg+'</div>'
      +'<button onclick="runScreen()" class="sbtn" style="margin-top:6px;">Réessayer</button>';
  }

  try{
    setStep('Connexion ClinicalTrials.gov…');
    var ct = await fetchClinicalTrialsPhase3();
    setStep(ct.length+' études Phase III récupérées — chargement FDA…');
    _screenData = ct;

    var fda = await fetchFDAPending();
    mergeFDAData(fda);
    setStep(_screenData.length+' entrées totales — affichage…');

    if(_screenData.length === 0){
      showErr('Aucune donnée reçue. Vérifie ta connexion internet.');
      btn.disabled = false;
      return;
    }

    try{ localStorage.setItem('ss_screen_cache', JSON.stringify({data:_screenData, ts:Date.now()})); }catch(e){}
    loading.style.display = 'none';
    renderScreenResults();

  }catch(e){
    showErr('Erreur : '+e.message+' — '+e.stack);
  }finally{
    btn.disabled = false;
  }
}

async function fetchClinicalTrialsPhase3(){
  var results = [];
  var seen    = {};

  var urls = [
    'https://clinicaltrials.gov/api/v2/studies?format=json&pageSize=100&filter.phase=PHASE3&filter.overallStatus=RECRUITING',
    'https://clinicaltrials.gov/api/v2/studies?format=json&pageSize=100&filter.phase=PHASE3&filter.overallStatus=ACTIVE_NOT_RECRUITING',
    'https://clinicaltrials.gov/api/v2/studies?format=json&pageSize=100&filter.phase=PHASE3&filter.overallStatus=COMPLETED&sort=LastUpdatePostDate:desc'
  ];

  var responses = await Promise.allSettled(
    urls.map(function(url){
      return fetch(url, {signal: AbortSignal.timeout(15000)})
        .then(function(r){
          if(!r.ok) throw new Error('HTTP '+r.status+' for '+url);
          return r.json();
        });
    })
  );

  responses.forEach(function(res){
    if(res.status === 'rejected'){
      console.warn('ClinicalTrials fetch failed:', res.reason);
      return;
    }
    var data = res.value;
    if(!data || !data.studies) return;

    data.studies.forEach(function(s){
      var p   = s.protocolSection || {};
      var id  = p.identificationModule          || {};
      var st  = p.statusModule                  || {};
      var sp  = p.sponsorCollaboratorsModule     || {};
      var co  = p.conditionsModule              || {};
      var nctId = id.nctId || '';
      if(seen[nctId]) return;
      seen[nctId] = true;

      var leadSponsor = (sp.leadSponsor && sp.leadSponsor.name) || '';
      var collabs     = (sp.collaborators||[]).map(function(c){ return c.name||''; });
      var allSponsors = [leadSponsor].concat(collabs);

      var bigpharmaMatch = '';
      for(var bi=0; bi<BIGPHARMA.length && !bigpharmaMatch; bi++){
        var bp = BIGPHARMA[bi].toLowerCase();
        for(var si=0; si<allSponsors.length; si++){
          if(allSponsors[si].toLowerCase().indexOf(bp) !== -1){
            bigpharmaMatch = BIGPHARMA[bi]; break;
          }
        }
      }

      var conditions  = (co.conditions||[]).slice(0,2).join(', ');
      var status      = st.overallStatus || '';
      var compDate    = (st.primaryCompletionDateStruct && st.primaryCompletionDateStruct.date) ||
                        (st.completionDateStruct         && st.completionDateStruct.date)         || '';

      results.push({
        nctId:         nctId,
        name:          leadSponsor,
        title:         (id.briefTitle||'').slice(0,80),
        indication:    conditions,
        phase:         'Phase III',
        status:        status,
        bigpharma:     bigpharmaMatch,
        completionDate:compDate,
        source:        'ClinicalTrials',
        fdaStatus:     '',
        emaStatus:     '',
        link:          'https://clinicaltrials.gov/study/'+nctId
      });
    });
  });

  return results;
}


async function fetchFDAPending(){
  var results = [];
  try{
    var urls = [
      'https://api.fda.gov/drug/drugsfda.json?search=application_type:BLA&limit=50&sort=submissions.submission_status_date:desc',
      'https://api.fda.gov/drug/drugsfda.json?search=application_type:NDA&limit=50&sort=submissions.submission_status_date:desc'
    ];
    var responses = await Promise.allSettled(
      urls.map(function(url){
        return fetch(url,{signal:AbortSignal.timeout(10000)}).then(function(r){ return r.ok?r.json():null; });
      })
    );
    responses.forEach(function(res, ri){
      if(res.status!=='fulfilled'||!res.value) return;
      var appType = ri===0?'BLA':'NDA';
      (res.value.results||[]).forEach(function(r){
        var subs = (r.submissions||[]).sort(function(a,b){
          return (b.submission_status_date||'').localeCompare(a.submission_status_date||'');
        });
        var latest = subs[0]||{};
        var brand  = (r.products&&r.products[0]&&r.products[0].brand_name)||'';
        var ing    = (r.products&&r.products[0]&&r.products[0].active_ingredients&&
                      r.products[0].active_ingredients[0]&&r.products[0].active_ingredients[0].name)||'';
        results.push({
          nctId:         appType+'-'+r.application_number,
          name:          r.sponsor_name||'',
          title:         brand||ing||r.application_number,
          indication:    ing,
          phase:         appType,
          status:        latest.submission_status||'',
          bigpharma:     '',
          completionDate:(latest.submission_status_date||'').slice(0,10),
          source:        'FDA',
          fdaStatus:     appType+' '+(latest.submission_status||''),
          emaStatus:     '',
          link:          'https://www.accessdata.fda.gov/scripts/cder/daf/index.cfm?event=overview.process&ApplNo='+r.application_number
        });
      });
    });
  }catch(e){ console.warn('FDA fetch error:', e); }
  return results;
}


async function fetchEMAPending(){
  var results = [];
  try{
    // EMA medicines under evaluation (public EPAR data)
    var url = 'https://www.ema.europa.eu/en/medicines/download-medicine-data';
    // EMA has a medicines API
    var url2 = 'https://www.ema.europa.eu/sites/default/files/Medicines_output_european_public_assessment_reports.xlsx';
    // Instead use the EMA product data API
    var url3 = 'https://api.fda.gov/drug/drugsfda.json?search=application_type:NDA+AND+submissions.submission_status:AP&limit=50&sort=submissions.submission_status_date:desc';
    var resp = await fetch(url3, {signal: AbortSignal.timeout(8000)});
    if(resp.ok){
      var d = await resp.json();
      (d.results||[]).forEach(function(r){
        results.push({
          nctId: 'NDA-'+r.application_number,
          name: r.sponsor_name||'',
          title: (r.products&&r.products[0]&&r.products[0].brand_name)||r.application_number,
          indication: (r.products&&r.products[0]&&r.products[0].active_ingredients&&r.products[0].active_ingredients[0]&&r.products[0].active_ingredients[0].name)||'',
          phase: 'Soumis FDA',
          status: 'NDA Approved',
          bigpharma: '',
          completionDate: (r.submissions&&r.submissions[0]&&r.submissions[0].submission_status_date)||'',
          source: 'FDA/NDA',
          fdaStatus: 'NDA Approuvé',
          emaStatus: '',
          link: 'https://www.accessdata.fda.gov/scripts/cder/daf/index.cfm?event=overview.process&ApplNo='+r.application_number
        });
      });
    }
  }catch(e){}
  return results;
}

function mergeFDAData(newEntries){
  newEntries.forEach(function(e){
    // Try to match with existing entry by sponsor name
    var existing = _screenData.find(function(d){
      return d.name && e.name && 
             d.name.toLowerCase().indexOf(e.name.toLowerCase().slice(0,8)) !== -1;
    });
    if(existing){
      if(e.fdaStatus) existing.fdaStatus = e.fdaStatus;
      if(e.emaStatus) existing.emaStatus = e.emaStatus;
    } else {
      _screenData.push(e);
    }
  });
}

function renderScreenResults(){
  var tbody   = document.getElementById('screen-tbody');
  var results = document.getElementById('screen-results');
  var stats   = document.getElementById('screen-stats');
  if(!tbody) return;

  // Apply filters
  var filtered = applyScreenFilters(_screenData);

  // Apply sort
  filtered.sort(function(a,b){
    var va = (a[_screenSort.col]||'').toString().toLowerCase();
    var vb = (b[_screenSort.col]||'').toString().toLowerCase();
    return _screenSort.asc ? va.localeCompare(vb) : vb.localeCompare(va);
  });

  tbody.innerHTML = '';
  filtered.forEach(function(r){
    var statusCls = r.status==='RECRUITING'?'recruiting':
                    r.status==='ACTIVE_NOT_RECRUITING'?'active':
                    r.status.indexOf('Approv')!==-1?'approved':
                    r.status==='COMPLETED'?'completed':'pending';
    var statusLbl = r.status==='ACTIVE_NOT_RECRUITING'?'Actif (non recrut.)':
                    r.status==='RECRUITING'?'Recrutement':
                    r.status;

    var tr = document.createElement('tr');
    tr.className = 'screen-row';
    tr.innerHTML = 
      '<td style="padding:8px 6px;max-width:140px;">'
        +'<div style="font-weight:700;font-size:12px;">'+escH(r.name)+'</div>'
        +(r.title?'<div style="font-size:10px;color:var(--muted);line-height:1.3;margin-top:2px;">'+escH(r.title.slice(0,70))+(r.title.length>70?'...':'')+'</div>':'')
      +'</td>'
      +'<td style="padding:8px 6px;font-size:11px;color:var(--muted);max-width:120px;">'+escH(r.indication.slice(0,60))+'</td>'
      +'<td style="padding:8px 6px;text-align:center;"><span class="screen-badge phase3">'+escH(r.phase)+'</span></td>'
      +'<td style="padding:8px 6px;">'
        +'<span class="screen-badge '+statusCls+'">'+escH(statusLbl)+'</span>'
        +(r.fdaStatus?'<br><span class="screen-badge approved" style="margin-top:2px;display:inline-block;">FDA: '+escH(r.fdaStatus)+'</span>':'')
        +(r.emaStatus?'<br><span class="screen-badge approved" style="margin-top:2px;display:inline-block;">EMA: '+escH(r.emaStatus)+'</span>':'')
      +'</td>'
      +'<td style="padding:8px 6px;">'
        +(r.bigpharma?'<span class="screen-badge bigpharma">'+escH(r.bigpharma)+'</span>':'<span style="color:var(--muted);font-size:10px;">—</span>')
      +'</td>'
      +'<td style="padding:8px 6px;font-size:11px;color:var(--muted);">'+escH(r.completionDate.slice(0,10))+'</td>'
      +'<td style="padding:8px 6px;text-align:center;">'
        +'<a href="'+r.link+'" target="_blank" style="font-size:10px;color:var(--accent);">↗ Voir</a>'
        +' <button onclick="loadScreenCompany('+JSON.stringify(r.name)+')" style="font-size:10px;padding:2px 7px;border:1px solid var(--accent);border-radius:4px;background:none;color:var(--accent);cursor:pointer;margin-left:4px;">Analyser</button>'
      +'</td>';
    tbody.appendChild(tr);
  });

  results.style.display = 'block';
  stats.style.display = 'flex';
  stats.innerHTML = '<strong>'+filtered.length+'</strong>&nbsp;résultats'
    +' · <span style="color:#534AB7;">'+_screenData.filter(function(r){return r.phase==='Phase III'||r.phase==='Soumis FDA';}).length+' Phase III/Soumis</span>'
    +' · <span style="color:#7C3AED;">'+_screenData.filter(function(r){return r.bigpharma;}).length+' avec BigPharma</span>'
    +' · <span style="font-size:10px;">source: ClinicalTrials.gov + FDA.gov</span>';
}

function applyScreenFilters(data){
  var f3      = document.getElementById('f-phase3') && document.getElementById('f-phase3').checked;
  var fbp     = document.getElementById('f-bigpharma') && document.getElementById('f-bigpharma').checked;
  var ffda    = document.getElementById('f-fda-pending') && document.getElementById('f-fda-pending').checked;
  var fema    = document.getElementById('f-ema') && document.getElementById('f-ema').checked;
  var search  = (document.getElementById('screen-search')||{value:''}).value.toLowerCase().trim();

  return data.filter(function(r){
    // At least one active filter must match, or no filters active
    var anyFilterActive = f3||fbp||ffda||fema;
    if(anyFilterActive){
      var matches = false;
      if(f3  && (r.phase==='Phase III'||r.status==='RECRUITING'||r.status==='ACTIVE_NOT_RECRUITING')) matches=true;
      if(fbp && r.bigpharma) matches=true;
      if(ffda && r.fdaStatus) matches=true;
      if(fema && r.emaStatus) matches=true;
      if(!matches) return false;
    }
    if(search){
      var txt = (r.name+r.title+r.indication+r.bigpharma).toLowerCase();
      if(txt.indexOf(search)===-1) return false;
    }
    return true;
  });
}

function filterScreenResults(){ if(_screenData.length) renderScreenResults(); }

function sortScreen(col){
  if(_screenSort.col===col) _screenSort.asc=!_screenSort.asc;
  else { _screenSort.col=col; _screenSort.asc=true; }
  renderScreenResults();
}

function loadScreenCompany(name){
  document.getElementById('cInput').value = name;
  switchTab('analyze');
  sT('bio');
  setTimeout(function(){ go(name); }, 100);
}

function escH(s){ 
  return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); 
}
// ===========================================================================

updateCounts();

