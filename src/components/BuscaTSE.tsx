import { useState, useRef, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Search, Loader2, MapPin, ChevronDown, Check } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { normalize } from "@/lib/validateVotes";

interface CandidatoResult {
  id: number;
  nome: string;
  nomeUrna: string;
  numero: number;
  partido: string;
  cargo: string;
  situacao: string;
  municipio: string;
  codigoMunicipio?: string;
  ano: number;
  totalVotos: number;
  bairrosZona?: string;
}


interface Props {
  onSelect: (candidato: CandidatoResult) => void;
}

// Cidades com atalho rápido
const CIDADES_RAPIDAS = [
  { code: "93734", name: "Goiânia" },
  { code: "92274", name: "Aparecida de Goiânia" },
  { code: "92215", name: "Anápolis" },
  { code: "92703", name: "Senador Canedo" },
  { code: "96253", name: "Trindade" },
  { code: "93890", name: "Hidrolândia" },
  { code: "93750", name: "Goianira" },
  { code: "94870", name: "Nerópolis" },
];

// Default: Goiânia + Aparecida
const DEFAULT_CODES = ["93734", "92274"];

const TODAS_CIDADES: { code: string; name: string }[] = [
  { code: "93360", name: "Abadia de Goiás" },
  { code: "92010", name: "Abadiânia" },
  { code: "96458", name: "Acreúna" },
  { code: "96911", name: "Adelândia" },
  { code: "92053", name: "Alexânia" },
  { code: "92096", name: "Aloândia" },
  { code: "92940", name: "Alto Horizonte" },
  { code: "92118", name: "Alto Paraíso de Goiás" },
  { code: "92150", name: "Alvorada do Norte" },
  { code: "93386", name: "Amaralina" },
  { code: "96610", name: "Americano do Brasil" },
  { code: "92177", name: "Amorinópolis" },
  { code: "92231", name: "Anhangüera" },
  { code: "92258", name: "Anicuns" },
  { code: "92215", name: "Anápolis" },
  { code: "92274", name: "Aparecida de Goiânia" },
  { code: "93009", name: "Aparecida do Rio Doce" },
  { code: "92290", name: "Aporé" },
  { code: "92339", name: "Aragarças" },
  { code: "92355", name: "Aragoiânia" },
  { code: "96695", name: "Araguapaz" },
  { code: "92312", name: "Araçu" },
  { code: "96717", name: "Arenópolis" },
  { code: "92495", name: "Aruanã" },
  { code: "92517", name: "Aurilândia" },
  { code: "92550", name: "Avelinópolis" },
  { code: "96938", name: "Água Fria de Goiás" },
  { code: "92037", name: "Água Limpa" },
  { code: "93343", name: "Águas Lindas de Goiás" },
  { code: "92614", name: "Baliza" },
  { code: "92630", name: "Barro Alto" },
  { code: "92657", name: "Bela Vista de Goiás" },
  { code: "92673", name: "Bom Jardim de Goiás" },
  { code: "92690", name: "Bom Jesus" },
  { code: "92029", name: "Bonfinópolis" },
  { code: "93408", name: "Bonópolis" },
  { code: "92711", name: "Brazabrantes" },
  { code: "92754", name: "Britânia" },
  { code: "92770", name: "Buriti Alegre" },
  { code: "93106", name: "Buriti de Goiás" },
  { code: "93262", name: "Buritinópolis" },
  { code: "92797", name: "Cabeceiras" },
  { code: "92819", name: "Cachoeira Alta" },
  { code: "92835", name: "Cachoeira de Goiás" },
  { code: "96733", name: "Cachoeira Dourada" },
  { code: "92878", name: "Caiapônia" },
  { code: "92894", name: "Caldas Novas" },
  { code: "93122", name: "Caldazinha" },
  { code: "92916", name: "Campestre de Goiás" },
  { code: "96873", name: "Campinaçu" },
  { code: "92932", name: "Campinorte" },
  { code: "92959", name: "Campo Alegre de Goiás" },
  { code: "93580", name: "Campo Limpo de Goiás" },
  { code: "92975", name: "Campos Belos" },
  { code: "92061", name: "Campos Verdes" },
  { code: "92991", name: "Carmo do Rio Verde" },
  { code: "92967", name: "Castelândia" },
  { code: "93017", name: "Catalão" },
  { code: "93033", name: "Caturaí" },
  { code: "93050", name: "Cavalcante" },
  { code: "92851", name: "Caçu" },
  { code: "93076", name: "Ceres" },
  { code: "92100", name: "Cezarina" },
  { code: "92924", name: "Chapadão do Céu" },
  { code: "93025", name: "Cidade Ocidental" },
  { code: "92886", name: "Cocalzinho de Goiás" },
  { code: "92126", name: "Colinas do Sul" },
  { code: "93190", name: "Corumbaíba" },
  { code: "93173", name: "Corumbá de Goiás" },
  { code: "93254", name: "Cristalina" },
  { code: "93270", name: "Cristianópolis" },
  { code: "93297", name: "Crixás" },
  { code: "93319", name: "Cromínia" },
  { code: "93335", name: "Cumari" },
  { code: "93157", name: "Córrego do Ouro" },
  { code: "93351", name: "Damianópolis" },
  { code: "93378", name: "Damolândia" },
  { code: "93394", name: "Davinópolis" },
  { code: "93432", name: "Diorama" },
  { code: "93092", name: "Divinópolis de Goiás" },
  { code: "96750", name: "Doverlândia" },
  { code: "92207", name: "Edealina" },
  { code: "93491", name: "Edéia" },
  { code: "93513", name: "Estrela do Norte" },
  { code: "92223", name: "Faina" },
  { code: "93530", name: "Fazenda Nova" },
  { code: "93572", name: "Firminópolis" },
  { code: "93599", name: "Flores de Goiás" },
  { code: "93610", name: "Formosa" },
  { code: "93637", name: "Formoso" },
  { code: "93564", name: "Gameleira de Goiás" },
  { code: "93696", name: "Goiandira" },
  { code: "93750", name: "Goianira" },
  { code: "93670", name: "Goianápolis" },
  { code: "93718", name: "Goianésia" },
  { code: "93793", name: "Goiatuba" },
  { code: "93777", name: "Goiás" },
  { code: "93734", name: "Goiânia" },
  { code: "92266", name: "Gouvelândia" },
  { code: "93815", name: "Guapó" },
  { code: "93831", name: "Guarani de Goiás" },
  { code: "93149", name: "Guaraíta" },
  { code: "92860", name: "Guarinos" },
  { code: "93874", name: "Heitoraí" },
  { code: "93912", name: "Hidrolina" },
  { code: "93890", name: "Hidrolândia" },
  { code: "93939", name: "Iaciara" },
  { code: "93165", name: "Inaciolândia" },
  { code: "96814", name: "Indiara" },
  { code: "93955", name: "Inhumas" },
  { code: "93971", name: "Ipameri" },
  { code: "93548", name: "Ipiranga de Goiás" },
  { code: "93998", name: "Iporá" },
  { code: "94013", name: "Israelândia" },
  { code: "94030", name: "Itaberaí" },
  { code: "92282", name: "Itaguari" },
  { code: "94072", name: "Itaguaru" },
  { code: "94110", name: "Itajá" },
  { code: "94137", name: "Itapaci" },
  { code: "94153", name: "Itapirapuã" },
  { code: "94196", name: "Itapuranga" },
  { code: "94218", name: "Itarumã" },
  { code: "94234", name: "Itauçu" },
  { code: "94250", name: "Itumbiara" },
  { code: "94277", name: "Ivolândia" },
  { code: "94293", name: "Jandaia" },
  { code: "94315", name: "Jaraguá" },
  { code: "94331", name: "Jataí" },
  { code: "94358", name: "Jaupaci" },
  { code: "92983", name: "Jesúpolis" },
  { code: "94374", name: "Joviânia" },
  { code: "94390", name: "Jussara" },
  { code: "93602", name: "Lagoa Santa" },
  { code: "94439", name: "Leopoldo de Bulhões" },
  { code: "94455", name: "Luziânia" },
  { code: "94471", name: "Mairipotaba" },
  { code: "94498", name: "Mambaí" },
  { code: "94510", name: "Mara Rosa" },
  { code: "94536", name: "Marzagão" },
  { code: "92320", name: "Matrinchã" },
  { code: "94579", name: "Maurilândia" },
  { code: "92347", name: "Mimoso de Goiás" },
  { code: "96474", name: "Minaçu" },
  { code: "94595", name: "Mineiros" },
  { code: "94650", name: "Moiporá" },
  { code: "94676", name: "Monte Alegre de Goiás" },
  { code: "94714", name: "Montes Claros de Goiás" },
  { code: "92363", name: "Montividiu" },
  { code: "93181", name: "Montividiu do Norte" },
  { code: "94730", name: "Morrinhos" },
  { code: "92169", name: "Morro Agudo de Goiás" },
  { code: "94757", name: "Mossâmedes" },
  { code: "94773", name: "Mozarlândia" },
  { code: "96512", name: "Mundo Novo" },
  { code: "94790", name: "Mutunópolis" },
  { code: "94854", name: "Nazário" },
  { code: "94870", name: "Nerópolis" },
  { code: "94897", name: "Niquelândia" },
  { code: "94919", name: "Nova América" },
  { code: "94935", name: "Nova Aurora" },
  { code: "96539", name: "Nova Crixás" },
  { code: "96555", name: "Nova Glória" },
  { code: "93084", name: "Nova Iguaçu de Goiás" },
  { code: "94951", name: "Nova Roma" },
  { code: "94978", name: "Nova Veneza" },
  { code: "95010", name: "Novo Brasil" },
  { code: "93327", name: "Novo Gama" },
  { code: "92444", name: "Novo Planalto" },
  { code: "95036", name: "Orizona" },
  { code: "95052", name: "Ouro Verde de Goiás" },
  { code: "95079", name: "Ouvidor" },
  { code: "95095", name: "Padre Bernardo" },
  { code: "92460", name: "Palestina de Goiás" },
  { code: "95117", name: "Palmeiras de Goiás" },
  { code: "95133", name: "Palmelo" },
  { code: "95150", name: "Palminópolis" },
  { code: "95176", name: "Panamá" },
  { code: "94552", name: "Paranaiguara" },
  { code: "95230", name: "Paraúna" },
  { code: "93068", name: "Perolândia" },
  { code: "95311", name: "Petrolina de Goiás" },
  { code: "95354", name: "Pilar de Goiás" },
  { code: "95397", name: "Piracanjuba" },
  { code: "95419", name: "Piranhas" },
  { code: "95435", name: "Pirenópolis" },
  { code: "95451", name: "Pires do Rio" },
  { code: "95958", name: "Planaltina" },
  { code: "95494", name: "Pontalina" },
  { code: "95559", name: "Porangatu" },
  { code: "93424", name: "Porteirão" },
  { code: "95575", name: "Portelândia" },
  { code: "95613", name: "Posse" },
  { code: "93041", name: "Professor Jamil" },
  { code: "95630", name: "Quirinópolis" },
  { code: "95656", name: "Rialma" },
  { code: "95672", name: "Rianápolis" },
  { code: "92827", name: "Rio Quente" },
  { code: "95710", name: "Rio Verde" },
  { code: "95737", name: "Rubiataba" },
  { code: "95753", name: "Sanclerlândia" },
  { code: "95770", name: "Santa Bárbara de Goiás" },
  { code: "95796", name: "Santa Cruz de Goiás" },
  { code: "92568", name: "Santa Fé de Goiás" },
  { code: "95818", name: "Santa Helena de Goiás" },
  { code: "96890", name: "Santa Isabel" },
  { code: "95834", name: "Santa Rita do Araguaia" },
  { code: "93440", name: "Santa Rita do Novo Destino" },
  { code: "95850", name: "Santa Rosa de Goiás" },
  { code: "95877", name: "Santa Tereza de Goiás" },
  { code: "95893", name: "Santa Terezinha de Goiás" },
  { code: "93203", name: "Santo Antônio da Barra" },
  { code: "92908", name: "Santo Antônio de Goiás" },
  { code: "96776", name: "Santo Antônio do Descoberto" },
  { code: "92703", name: "Senador Canedo" },
  { code: "96075", name: "Serranópolis" },
  { code: "96091", name: "Silvânia" },
  { code: "92720", name: "Simolândia" },
  { code: "95915", name: "São Domingos" },
  { code: "95931", name: "São Francisco de Goiás" },
  { code: "95974", name: "São João d'Aliança" },
  { code: "92622", name: "São João da Paraúna" },
  { code: "92649", name: "São Luiz do Norte" },
  { code: "95990", name: "São Luís de Montes Belos" },
  { code: "96016", name: "São Miguel do Araguaia" },
  { code: "92665", name: "São Miguel do Passa Quatro" },
  { code: "93483", name: "São Patrício" },
  { code: "96059", name: "São Simão" },
  { code: "96113", name: "Sítio d'Abadia" },
  { code: "96172", name: "Taquaral de Goiás" },
  { code: "92762", name: "Teresina de Goiás" },
  { code: "93220", name: "Terezópolis de Goiás" },
  { code: "96253", name: "Trindade" },
  { code: "92789", name: "Trombas" },
  { code: "96237", name: "Três Ranchos" },
  { code: "92800", name: "Turvelândia" },
  { code: "96318", name: "Turvânia" },
  { code: "93246", name: "Uirapuru" },
  { code: "96350", name: "Uruana" },
  { code: "96334", name: "Uruaçu" },
  { code: "96377", name: "Urutaí" },
  { code: "93300", name: "Valparaíso de Goiás" },
  { code: "96393", name: "Varjão" },
  { code: "96415", name: "Vianópolis" },
  { code: "96571", name: "Vicentinópolis" },
  { code: "93289", name: "Vila Boa" },
  { code: "93505", name: "Vila Propício" },
];

const getCidadeNames = (codes: string[]) => {
  if (codes.length === 0) return "Todo o Estado de Goiás";
  const names = codes.map(c => TODAS_CIDADES.find(ci => ci.code === c)?.name || c);
  if (names.length <= 2) return names.join(" e ");
  return `${names[0]} +${names.length - 1}`;
};

export default function BuscaTSE({ onSelect }: Props) {
  const [nome, setNome] = useState("");
  const [ano, setAno] = useState("2024");
  const [selectedCodes, setSelectedCodes] = useState<string[]>(DEFAULT_CODES);
  const [cidadeOpen, setCidadeOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<CandidatoResult[]>([]);
  const [showResults, setShowResults] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const abortRef = useRef<AbortController>();
  const containerRef = useRef<HTMLDivElement>(null);
  const existingNamesRef = useRef<Set<string>>(new Set());
  const lastFetchRef = useRef(0);

  // Pre-fetch existing names once on mount
  useEffect(() => {
    supabase.from("suplentes").select("nome").then(({ data }) => {
      existingNamesRef.current = new Set((data || []).map((s: any) => normalize(s.nome || "")));
      lastFetchRef.current = Date.now();
    });
  }, []);

  const doSearch = useCallback(async (searchTerm: string, year: string, codes: string[]) => {
    if (searchTerm.trim().length < 3) {
      setResults([]);
      setShowResults(false);
      return;
    }

    // Abort previous request
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setShowResults(true);
    try {
      const municipioNames = codes
        .map(code => TODAS_CIDADES.find(c => c.code === code)?.name || "")
        .filter(Boolean);

      const params: Record<string, string> = {
        nome: searchTerm.trim(),
        ano: year,
        limit: "20",
        location: "US",
      };

      if (municipioNames.length > 0) {
        params.municipios = municipioNames.join(",");
      }

      // Refresh existing names if stale (>60s)
      if (Date.now() - lastFetchRef.current > 60000) {
        supabase.from("suplentes").select("nome").then(({ data }) => {
          existingNamesRef.current = new Set((data || []).map((s: any) => normalize(s.nome || "")));
          lastFetchRef.current = Date.now();
        });
      }

      const { data, error } = await supabase.functions.invoke("consultar-bigquery", {
        body: { consulta: "buscar_candidatos", params },
      });

      if (controller.signal.aborted) return;
      if (error) throw error;

      const resultados: CandidatoResult[] = ((data?.dados as any[]) || [])
        .filter((row: any) => !existingNamesRef.current.has(normalize(row.nm_candidato || "")))
        .map((row: any) => ({
          id: parseInt(row.sq_candidato || row.nr_candidato || "0"),
          nome: row.nm_candidato || "",
          nomeUrna: row.nm_urna_candidato || "",
          numero: parseInt(row.nr_candidato || "0"),
          partido: row.sg_partido || "",
          cargo: row.ds_cargo || "",
          situacao: row.ds_sit_tot_turno || "",
          municipio: row.nm_ue || "",
          ano: parseInt(year),
          totalVotos: parseInt(row.total_votos || "0"),
          bairrosZona: row.bairros_zona || "",
        }));

      setResults(resultados);
    } catch (e: any) {
      if (controller.signal.aborted) return;
      toast({ title: "Erro na busca", description: e.message, variant: "destructive" });
      setResults([]);
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, []);

  const handleChange = (value: string) => {
    setNome(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (value.trim().length >= 3) {
      debounceRef.current = setTimeout(() => doSearch(value, ano, selectedCodes), 400);
    } else {
      abortRef.current?.abort();
      setResults([]);
      setShowResults(false);
      setLoading(false);
    }
  };

  const handleSelect = (c: CandidatoResult) => {
    onSelect(c);
    setNome(c.nome);
    setShowResults(false);
    setResults([]);
  };

  const toggleCidade = (code: string) => {
    setSelectedCodes(prev => {
      const next = prev.includes(code)
        ? prev.filter(c => c !== code)
        : [...prev, code];
      // Re-search if user has typed
      if (nome.trim().length >= 3) {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => doSearch(nome, ano, next), 400);
      }
      return next;
    });
  };

  const selectTodoEstado = () => {
    setSelectedCodes([]);
    setCidadeOpen(false);
    if (nome.trim().length >= 3) {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => doSearch(nome, ano, []), 400);
    }
  };

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowResults(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={containerRef} className="relative space-y-2">
      {/* City selector + Year */}
      <div className="flex items-center gap-2">
        <Popover open={cidadeOpen} onOpenChange={setCidadeOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={cidadeOpen}
              className="flex-1 justify-between bg-card shadow-sm border-border text-sm font-normal h-9 truncate"
            >
              <span className="flex items-center gap-1.5 truncate">
                <MapPin size={12} className="shrink-0 text-primary" />
                <span className="truncate">{getCidadeNames(selectedCodes)}</span>
              </span>
              <ChevronDown size={12} className="shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[calc(100vw-2rem)] max-w-[300px] p-0" align="start">
            <Command>
              <CommandInput placeholder="Buscar cidade..." />
              <CommandList>
                <CommandEmpty>Cidade não encontrada.</CommandEmpty>
                <CommandGroup heading="Ações">
                  <CommandItem onSelect={selectTodoEstado}>
                    🗺️ Todo o Estado de Goiás
                  </CommandItem>
                  <CommandItem onSelect={() => { setSelectedCodes(DEFAULT_CODES); }}>
                    ⭐ Goiânia + Aparecida (padrão)
                  </CommandItem>
                </CommandGroup>
                <CommandGroup heading="⭐ Principais">
                  {CIDADES_RAPIDAS.map((c) => (
                    <CommandItem key={`quick-${c.code}`} value={`quick-${c.name}`} onSelect={() => toggleCidade(c.code)}>
                      <Check size={14} className={cn("mr-2 shrink-0", selectedCodes.includes(c.code) ? "opacity-100 text-primary" : "opacity-0")} />
                      {c.name}
                    </CommandItem>
                  ))}
                </CommandGroup>
                <CommandGroup heading="Todas as cidades">
                  {TODAS_CIDADES.map((c) => (
                    <CommandItem key={c.code} value={c.name} onSelect={() => toggleCidade(c.code)}>
                      <Check size={14} className={cn("mr-2 shrink-0", selectedCodes.includes(c.code) ? "opacity-100 text-primary" : "opacity-0")} />
                      {c.name}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

        <Select value={ano} onValueChange={(v) => { setAno(v); if (nome.trim().length >= 3) doSearch(nome, v, selectedCodes); }}>
          <SelectTrigger className="w-20 bg-card shadow-sm border-border h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="2024">2024</SelectItem>
            <SelectItem value="2022">2022</SelectItem>
            <SelectItem value="2020">2020</SelectItem>
            <SelectItem value="2018">2018</SelectItem>
            <SelectItem value="2016">2016</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Search input */}
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Digite nome completo ou de campanha..."
          value={nome}
          onChange={(e) => handleChange(e.target.value)}
          onFocus={() => results.length > 0 && setShowResults(true)}
          className="bg-card shadow-sm border-border pl-9"
        />
        {loading && (
          <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-muted-foreground" />
        )}
      </div>

      {showResults && loading && (
        <div className="absolute z-50 left-0 right-0 top-full mt-1 rounded-xl border border-border bg-popover shadow-lg p-4">
          <div className="flex items-center gap-2 justify-center">
            <Loader2 size={16} className="animate-spin text-primary" />
            <span className="text-sm text-muted-foreground">Buscando candidatos...</span>
          </div>
        </div>
      )}

      {showResults && !loading && results.length === 0 && nome.trim().length >= 3 && (
        <p className="text-xs text-muted-foreground px-1">Nenhum resultado. Tente outro nome, cidade ou ano.</p>
      )}

      {showResults && !loading && results.length > 0 && (
        <div className="absolute z-50 left-0 right-0 top-full mt-1 max-h-[50vh] overflow-y-auto overscroll-y-contain rounded-xl border border-border bg-popover shadow-lg"
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          <div className="px-3 py-1.5 border-b border-border sticky top-0 bg-popover z-10">
            <p className="text-[11px] text-muted-foreground">{results.length} resultado(s)</p>
          </div>
          {results.map((c) => (
            <button
              key={`${c.id}-${c.municipio}`}
              onClick={() => handleSelect(c)}
              className="w-full text-left px-3 py-3 active:bg-accent/70 hover:bg-accent/50 transition-colors border-b border-border/50 last:border-0"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground truncate">{c.nome}</p>
                  {c.nomeUrna && c.nomeUrna.toUpperCase() !== c.nome.toUpperCase() && (
                    <p className="text-[11px] text-muted-foreground truncate">Urna: {c.nomeUrna}</p>
                  )}
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
                    <span className="text-[11px] font-medium text-primary">{c.partido}</span>
                    <span className="text-[11px] text-muted-foreground">{c.cargo}</span>
                    <span className="flex items-center gap-0.5 text-[11px] text-muted-foreground">
                      <MapPin size={9} /> {c.municipio}
                    </span>
                    {c.totalVotos > 0 && (
                      <span className="text-[11px] font-semibold text-foreground">🗳️ {c.totalVotos.toLocaleString("pt-BR")} votos</span>
                    )}
                  </div>
                </div>
                <span className="text-[10px] font-medium uppercase tracking-wider text-primary whitespace-nowrap mt-0.5">
                  {c.situacao}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
