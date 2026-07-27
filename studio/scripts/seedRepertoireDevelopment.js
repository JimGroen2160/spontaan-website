import {createReadStream} from 'node:fs'
import {resolve} from 'node:path'
import {getCliClient} from 'sanity/cli'

const client = getCliClient({apiVersion: '2026-07-06'})
const EXPECTED_DATASET = 'development'
const item = (id, title, fields = {}) => ({_id:id,_type:'repertoireItem',title:`[TEST] ${title}`,isVisible:true,isTestData:true,...fields})

async function uploadAudio(filename) {
  const existing = await client.fetch('*[_type == "sanity.fileAsset" && originalFilename == $filename][0]._id',{filename})
  if (existing) return existing
  return (await client.assets.upload('file',createReadStream(resolve(process.cwd(),`../data/${filename}`)),{filename,contentType:'audio/wav'}))._id
}
async function uploadImage(filename) {
  const existing = await client.fetch('*[_type == "sanity.imageAsset" && originalFilename == $filename][0]._id',{filename})
  if (existing) return existing
  return (await client.assets.upload('image',createReadStream(resolve(process.cwd(),`../images/repertoire/${filename}`)),{filename}))._id
}
const reference = (_ref,_key) => ({_type:'reference',_ref,_key})

async function main() {
  if (client.config().dataset !== EXPECTED_DATASET) throw new Error(`Seed afgebroken: alleen dataset "${EXPECTED_DATASET}" is toegestaan.`)
  const warm=await uploadAudio('test-repertoire-warm.wav'); const helder=await uploadAudio('test-repertoire-helder.wav')
  const assets={hero:await uploadImage('repertoire-hero.jpg'),featured:await uploadImage('repertoire-uitgelicht.jpg'),classic:await uploadImage('repertoire-klassiek.jpg'),dutch:await uploadImage('repertoire-nederlandstalig.jpg'),festive:await uploadImage('repertoire-feestelijk.jpg'),quote:await uploadImage('repertoire-dirigent.jpg')}
  const specs=[
    ['the-rose','The Rose',{story:'Een ode aan liefde, hoop en herinnering: ontdek de muzikale reis die dit lied binnen onze samenzang aflegt.',audioDescription:'Luisterfragment van The Rose',audioFile:{_type:'file',asset:{_type:'reference',_ref:warm}}}],
    ['sound-of-silence','The Sound of Silence — arr. Carl Goff / Roger Emerson'],['nunc-dimittis','Nunc dimittis — Ola Gjeilo'],
    ['avond','Avond',{audioDescription:'Luisterfragment van Avond',audioFile:{_type:'file',asset:{_type:'reference',_ref:helder}}}],['toen-de-dagen-komen','Toen de dagen komen'],['als-de-dag-van-toen','Als de dag van toen'],
    ['joy-to-the-lord','Joy to the Lord — M. Schröder'],['shine','Shine — L. Larson'],
    ['hallelujah','Hallelujah',{audioDescription:'Luisterfragment van Hallelujah',audioFile:{_type:'file',asset:{_type:'reference',_ref:warm}}}],['het-dorp','Het Dorp'],['vamos-a-cantar','Vamos a Cantar']
  ]
  const items=specs.map(([id,title,fields])=>item(`test-repertoire-${id}`,title,fields||{})); const by=Object.fromEntries(items.map(x=>[x._id,x]))
  const page={_id:'repertoirePage-main',_type:'repertoirePage',title:'[TEST] Muziek en repertoire',isTestData:true,heroTitle:'Muziek en repertoire',heroSubtitle:'Verhalen die we samen tot leven zingen.',heroImage:{_type:'image',asset:{_type:'reference',_ref:assets.hero}},heroImageAlt:'Zanggroep Spontaan zingt onder leiding van de dirigent',featuredItem:reference(by['test-repertoire-the-rose']._id),featuredImage:{_type:'image',asset:{_type:'reference',_ref:assets.featured}},featuredImageAlt:'Zangers van Spontaan tijdens een warm en betrokken lied',worldsTitle:'Onze muzikale wereld',worldsIntro:'Diverse stijlen, één doel: samen verhalen tot leven brengen.',worlds:[
    {_type:'repertoireWorld',_key:'world-1',number:'01',title:'Krachtig en klassiek',description:'Van monumentaal tot intiem en verstild. Bijvoorbeeld deze stukken:',image:{_type:'image',asset:{_type:'reference',_ref:assets.classic}},imageAlt:'Zanggroep Spontaan zingt klassieke koormuziek',items:['the-rose','sound-of-silence','nunc-dimittis'].map((x,i)=>reference(by[`test-repertoire-${x}`]._id,`w1-${i}`))},
    {_type:'repertoireWorld',_key:'world-2',number:'02',title:'Warm en Nederlandstalig',description:'Dichtbij en herkenbaar – liederen die ons raken en verbinden.',image:{_type:'image',asset:{_type:'reference',_ref:assets.dutch}},imageAlt:'Zanggroep Spontaan zingt Nederlandstalige muziek',items:['avond','toen-de-dagen-komen','als-de-dag-van-toen'].map((x,i)=>reference(by[`test-repertoire-${x}`]._id,`w2-${i}`))},
    {_type:'repertoireWorld',_key:'world-3',number:'03',title:'Swingend en feestelijk',description:'Opzwepende klanken vol energie om mee te vieren en genieten.',image:{_type:'image',asset:{_type:'reference',_ref:assets.festive}},imageAlt:'Zanggroep Spontaan tijdens een feestelijk optreden',items:['joy-to-the-lord','shine','hallelujah'].map((x,i)=>reference(by[`test-repertoire-${x}`]._id,`w3-${i}`))}
  ],processTitle:'Hoe een muziekstuk gaat leven',processSteps:[['Kiezen','We selecteren muziek die leeft bij ons en ons publiek.'],['Instuderen','We werken aan ritme, klank, uitspraak en muzikale interpretatie.'],['Samenklank','We groeien als koor, met oog voor detail en voor elkaar.'],['Optreden','We delen onze muziek en ons verhaal op het podium.']].map(([title,description],i)=>({_type:'processStep',_key:`step-${i+1}`,title,description})),selectionTitle:'Een greep uit ons repertoire',selectionItems:['the-rose','avond','het-dorp','sound-of-silence','shine','nunc-dimittis'].map((x,i)=>reference(by[`test-repertoire-${x}`]._id,`selection-${i}`)),quote:'Een lied krijgt pas betekenis wanneer we het samen vertellen.',quoteAttribution:'Onze muzikale leider',quoteImage:{_type:'image',asset:{_type:'reference',_ref:assets.quote}},quoteImageAlt:'De dirigent van Zanggroep Spontaan leidt het mannenkoor',ctaEyebrow:'Nieuwsgierig?',ctaTitle:'Nieuwsgierig naar onze muziek?',ctaText:'Kom luisteren tijdens een repetitie.',primaryButtonLabel:'Kom kennismaken',primaryButtonLink:'./contact.html',secondaryButtonLabel:'Bekijk Beeld en Geluid',secondaryButtonLink:'./media.html'}
  const tx=client.transaction(); items.forEach(x=>tx.createOrReplace(x)); tx.createOrReplace(page); await tx.commit(); console.log('Wireframe-conforme repertoire-testdata geplaatst in development.')
}
main().catch((error)=>{console.error('Repertoire-seed mislukt:',error);process.exitCode=1})
