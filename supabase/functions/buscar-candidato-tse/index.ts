import "https://deno.land/x/xhr@0.1.0/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Todos os 246 municípios de Goiás com códigos TSE
const MUNICIPIOS_GO: Record<string, string> = {
  "93360": "ABADIA DE GOIÁS",
  "92010": "ABADIÂNIA",
  "96458": "ACREÚNA",
  "96911": "ADELÂNDIA",
  "92053": "ALEXÂNIA",
  "92096": "ALOÂNDIA",
  "92940": "ALTO HORIZONTE",
  "92118": "ALTO PARAÍSO DE GOIÁS",
  "92150": "ALVORADA DO NORTE",
  "93386": "AMARALINA",
  "96610": "AMERICANO DO BRASIL",
  "92177": "AMORINÓPOLIS",
  "92231": "ANHANGÜERA",
  "92258": "ANICUNS",
  "92215": "ANÁPOLIS",
  "92274": "APARECIDA DE GOIÂNIA",
  "93009": "APARECIDA DO RIO DOCE",
  "92290": "APORÉ",
  "92339": "ARAGARÇAS",
  "92355": "ARAGOIÂNIA",
  "96695": "ARAGUAPAZ",
  "92312": "ARAÇU",
  "96717": "ARENÓPOLIS",
  "92495": "ARUANÃ",
  "92517": "AURILÂNDIA",
  "92550": "AVELINÓPOLIS",
  "92614": "BALIZA",
  "92630": "BARRO ALTO",
  "92657": "BELA VISTA DE GOIÁS",
  "92673": "BOM JARDIM DE GOIÁS",
  "92690": "BOM JESUS",
  "92029": "BONFINÓPOLIS",
  "93408": "BONÓPOLIS",
  "92711": "BRAZABRANTES",
  "92754": "BRITÂNIA",
  "92770": "BURITI ALEGRE",
  "93106": "BURITI DE GOIÁS",
  "93262": "BURITINÓPOLIS",
  "92797": "CABECEIRAS",
  "92819": "CACHOEIRA ALTA",
  "92835": "CACHOEIRA DE GOIÁS",
  "96733": "CACHOEIRA DOURADA",
  "92878": "CAIAPÔNIA",
  "92894": "CALDAS NOVAS",
  "93122": "CALDAZINHA",
  "92916": "CAMPESTRE DE GOIÁS",
  "96873": "CAMPINAÇU",
  "92932": "CAMPINORTE",
  "92959": "CAMPO ALEGRE DE GOIÁS",
  "93580": "CAMPO LIMPO DE GOIÁS",
  "92975": "CAMPOS BELOS",
  "92061": "CAMPOS VERDES",
  "92991": "CARMO DO RIO VERDE",
  "92967": "CASTELÂNDIA",
  "93017": "CATALÃO",
  "93033": "CATURAÍ",
  "93050": "CAVALCANTE",
  "92851": "CAÇU",
  "93076": "CERES",
  "92100": "CEZARINA",
  "92924": "CHAPADÃO DO CÉU",
  "93025": "CIDADE OCIDENTAL",
  "92886": "COCALZINHO DE GOIÁS",
  "92126": "COLINAS DO SUL",
  "93190": "CORUMBAÍBA",
  "93173": "CORUMBÁ DE GOIÁS",
  "93254": "CRISTALINA",
  "93270": "CRISTIANÓPOLIS",
  "93297": "CRIXÁS",
  "93319": "CROMÍNIA",
  "93335": "CUMARI",
  "93157": "CÓRREGO DO OURO",
  "93351": "DAMIANÓPOLIS",
  "93378": "DAMOLÂNDIA",
  "93394": "DAVINÓPOLIS",
  "93432": "DIORAMA",
  "93092": "DIVINÓPOLIS DE GOIÁS",
  "96750": "DOVERLÂNDIA",
  "92207": "EDEALINA",
  "93491": "EDÉIA",
  "93513": "ESTRELA DO NORTE",
  "92223": "FAINA",
  "93530": "FAZENDA NOVA",
  "93572": "FIRMINÓPOLIS",
  "93599": "FLORES DE GOIÁS",
  "93610": "FORMOSA",
  "93637": "FORMOSO",
  "93564": "GAMELEIRA DE GOIÁS",
  "93696": "GOIANDIRA",
  "93750": "GOIANIRA",
  "93670": "GOIANÁPOLIS",
  "93718": "GOIANÉSIA",
  "93793": "GOIATUBA",
  "93777": "GOIÁS",
  "93734": "GOIÂNIA",
  "92266": "GOUVELÂNDIA",
  "93815": "GUAPÓ",
  "93831": "GUARANI DE GOIÁS",
  "93149": "GUARAÍTA",
  "92860": "GUARINOS",
  "93874": "HEITORAÍ",
  "93912": "HIDROLINA",
  "93890": "HIDROLÂNDIA",
  "93939": "IACIARA",
  "93165": "INACIOLÂNDIA",
  "96814": "INDIARA",
  "93955": "INHUMAS",
  "93971": "IPAMERI",
  "93548": "IPIRANGA DE GOIÁS",
  "93998": "IPORÁ",
  "94013": "ISRAELÂNDIA",
  "94030": "ITABERAÍ",
  "92282": "ITAGUARI",
  "94072": "ITAGUARU",
  "94110": "ITAJÁ",
  "94137": "ITAPACI",
  "94153": "ITAPIRAPUÃ",
  "94196": "ITAPURANGA",
  "94218": "ITARUMÃ",
  "94234": "ITAUÇU",
  "94250": "ITUMBIARA",
  "94277": "IVOLÂNDIA",
  "94293": "JANDAIA",
  "94315": "JARAGUÁ",
  "94331": "JATAÍ",
  "94358": "JAUPACI",
  "92983": "JESÚPOLIS",
  "94374": "JOVIÂNIA",
  "94390": "JUSSARA",
  "93602": "LAGOA SANTA",
  "94439": "LEOPOLDO DE BULHÕES",
  "94455": "LUZIÂNIA",
  "94471": "MAIRIPOTABA",
  "94498": "MAMBAÍ",
  "94510": "MARA ROSA",
  "94536": "MARZAGÃO",
  "92320": "MATRINCHÃ",
  "94579": "MAURILÂNDIA",
  "92347": "MIMOSO DE GOIÁS",
  "96474": "MINAÇU",
  "94595": "MINEIROS",
  "94650": "MOIPORÁ",
  "94676": "MONTE ALEGRE DE GOIÁS",
  "94714": "MONTES CLAROS DE GOIÁS",
  "92363": "MONTIVIDIU",
  "93181": "MONTIVIDIU DO NORTE",
  "94730": "MORRINHOS",
  "92169": "MORRO AGUDO DE GOIÁS",
  "94757": "MOSSÂMEDES",
  "94773": "MOZARLÂNDIA",
  "96512": "MUNDO NOVO",
  "94790": "MUTUNÓPOLIS",
  "94854": "NAZÁRIO",
  "94870": "NERÓPOLIS",
  "94897": "NIQUELÂNDIA",
  "94919": "NOVA AMÉRICA",
  "94935": "NOVA AURORA",
  "96539": "NOVA CRIXÁS",
  "96555": "NOVA GLÓRIA",
  "93084": "NOVA IGUAÇU DE GOIÁS",
  "94951": "NOVA ROMA",
  "94978": "NOVA VENEZA",
  "95010": "NOVO BRASIL",
  "93327": "NOVO GAMA",
  "92444": "NOVO PLANALTO",
  "95036": "ORIZONA",
  "95052": "OURO VERDE DE GOIÁS",
  "95079": "OUVIDOR",
  "95095": "PADRE BERNARDO",
  "92460": "PALESTINA DE GOIÁS",
  "95117": "PALMEIRAS DE GOIÁS",
  "95133": "PALMELO",
  "95150": "PALMINÓPOLIS",
  "95176": "PANAMÁ",
  "94552": "PARANAIGUARA",
  "95230": "PARAÚNA",
  "93068": "PEROLÂNDIA",
  "95311": "PETROLINA DE GOIÁS",
  "95354": "PILAR DE GOIÁS",
  "95397": "PIRACANJUBA",
  "95419": "PIRANHAS",
  "95435": "PIRENÓPOLIS",
  "95451": "PIRES DO RIO",
  "95958": "PLANALTINA",
  "95494": "PONTALINA",
  "95559": "PORANGATU",
  "93424": "PORTEIRÃO",
  "95575": "PORTELÂNDIA",
  "95613": "POSSE",
  "93041": "PROFESSOR JAMIL",
  "95630": "QUIRINÓPOLIS",
  "95656": "RIALMA",
  "95672": "RIANÁPOLIS",
  "92827": "RIO QUENTE",
  "95710": "RIO VERDE",
  "95737": "RUBIATABA",
  "95753": "SANCLERLÂNDIA",
  "95770": "SANTA BÁRBARA DE GOIÁS",
  "95796": "SANTA CRUZ DE GOIÁS",
  "92568": "SANTA FÉ DE GOIÁS",
  "95818": "SANTA HELENA DE GOIÁS",
  "96890": "SANTA ISABEL",
  "95834": "SANTA RITA DO ARAGUAIA",
  "93440": "SANTA RITA DO NOVO DESTINO",
  "95850": "SANTA ROSA DE GOIÁS",
  "95877": "SANTA TEREZA DE GOIÁS",
  "95893": "SANTA TEREZINHA DE GOIÁS",
  "93203": "SANTO ANTÔNIO DA BARRA",
  "92908": "SANTO ANTÔNIO DE GOIÁS",
  "96776": "SANTO ANTÔNIO DO DESCOBERTO",
  "92703": "SENADOR CANEDO",
  "96075": "SERRANÓPOLIS",
  "96091": "SILVÂNIA",
  "92720": "SIMOLÂNDIA",
  "95915": "SÃO DOMINGOS",
  "95931": "SÃO FRANCISCO DE GOIÁS",
  "95974": "SÃO JOÃO D'ALIANÇA",
  "92622": "SÃO JOÃO DA PARAÚNA",
  "92649": "SÃO LUIZ DO NORTE",
  "95990": "SÃO LUÍS DE MONTES BELOS",
  "96016": "SÃO MIGUEL DO ARAGUAIA",
  "92665": "SÃO MIGUEL DO PASSA QUATRO",
  "93483": "SÃO PATRÍCIO",
  "96059": "SÃO SIMÃO",
  "96113": "SÍTIO D'ABADIA",
  "96172": "TAQUARAL DE GOIÁS",
  "92762": "TERESINA DE GOIÁS",
  "93220": "TEREZÓPOLIS DE GOIÁS",
  "96253": "TRINDADE",
  "92789": "TROMBAS",
  "96237": "TRÊS RANCHOS",
  "92800": "TURVELÂNDIA",
  "96318": "TURVÂNIA",
  "93246": "UIRAPURU",
  "96350": "URUANA",
  "96334": "URUAÇU",
  "96377": "URUTAÍ",
  "93300": "VALPARAÍSO DE GOIÁS",
  "96393": "VARJÃO",
  "96415": "VIANÓPOLIS",
  "96571": "VICENTINÓPOLIS",
  "93289": "VILA BOA",
  "93505": "VILA PROPÍCIO",
  "96938": "ÁGUA FRIA DE GOIÁS",
  "92037": "ÁGUA LIMPA",
  "93343": "ÁGUAS LINDAS DE GOIÁS",
};

const ELEICAO_IDS: Record<number, string> = {
  2024: "2045202024",
  2020: "2030402020",
};

const CARGOS = [13];

interface CandidatoResult {
  id: number;
  nome: string;
  nomeUrna: string;
  numero: number;
  partido: string;
  cargo: string;
  situacao: string;
  municipio: string;
  codigoMunicipio: string;
  ano: number;
  totalVotos: number;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { nome, ano = 2024, codigosMunicipios } = await req.json();

    if (!nome || nome.trim().length < 3) {
      return new Response(
        JSON.stringify({ error: "Nome deve ter pelo menos 3 caracteres" }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const searchTerm = nome.trim().toUpperCase();
    const eleicaoId = ELEICAO_IDS[ano];

    if (!eleicaoId) {
      return new Response(
        JSON.stringify({ error: `Ano ${ano} não disponível. Use 2024 ou 2020.` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Support multiple municipality codes
    let entries: [string, string][];
    if (Array.isArray(codigosMunicipios) && codigosMunicipios.length > 0) {
      entries = codigosMunicipios
        .filter((c: string) => MUNICIPIOS_GO[c])
        .map((c: string) => [c, MUNICIPIOS_GO[c]] as [string, string]);
    } else {
      entries = Object.entries(MUNICIPIOS_GO);
    }

    const results: CandidatoResult[] = [];
    const errors: string[] = [];

    const batchSize = 15;

    for (let i = 0; i < entries.length; i += batchSize) {
      const batch = entries.slice(i, i + batchSize);
      const promises = batch.flatMap(([codigo, nomeMunicipio]) =>
        CARGOS.map(async (cargo) => {
          try {
            const url = `https://divulgacandcontas.tse.jus.br/divulga/rest/v1/candidatura/listar/${ano}/${codigo}/${eleicaoId}/${cargo}/candidatos`;
            const resp = await fetch(url, {
              headers: { 'Accept': 'application/json' },
            });
            if (!resp.ok) return;
            const data = await resp.json();
            const candidatos = data.candidatos || [];

            for (const c of candidatos) {
              const nomeCompleto = (c.nomeCompleto || "").toUpperCase();
              const nomeUrnaCand = (c.nomeUrna || "").toUpperCase();
              if (nomeCompleto.includes(searchTerm) || nomeUrnaCand.includes(searchTerm)) {
                results.push({
                  id: c.id,
                  nome: c.nomeCompleto || c.nomeUrna,
                  nomeUrna: c.nomeUrna || "",
                  numero: c.numero || 0,
                  partido: c.partido?.sigla || "",
                  cargo: c.cargo?.nome || "",
                  situacao: c.descricaoTotalizacao || c.descricaoSituacao || "",
                  municipio: nomeMunicipio,
                  codigoMunicipio: codigo,
                  ano,
                  totalVotos: 0,
                });
              }
            }
          } catch (e) {
            errors.push(`${nomeMunicipio}: ${e.message}`);
          }
        })
      );
      await Promise.all(promises);
    }

    results.sort((a, b) => a.nome.localeCompare(b.nome));

    return new Response(
      JSON.stringify({
        resultados: results,
        total: results.length,
        municipios_consultados: entries.length,
        erros: errors.length > 0 ? errors.slice(0, 5) : undefined,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
