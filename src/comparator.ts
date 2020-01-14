import { Country, Crime, getData } from './loader'; // getData will return luxembourg's data so far

const ICCS: {
    [key: string]: string;
} = {
    '01': 'Acts leading to death or intending to cause death',
    '0101': 'Intentional homicide',
    '0102': 'Attempted intentional homicide',
    '0103': 'Non-intentional homicide',
    '01031': 'Non-negligent manslaughter',
    '01032': 'Negligent manslaughter',
    '010321': 'Vehicular homicide',
    '010322': 'Non-vehicular homicide',
    '0104': 'Assisting or instigating suicide',
    '01041': 'Assisting suicide',
    '01049': 'Other acts of assisting or instigating suicide',
    '0105': 'Euthanasia',
    '0106': 'Illegal feticide',
    '0107': 'Unlawful killing associated with armed conflict',
    '0109': 'Other acts leading to death or intending to cause death',
    '02': 'Acts causing harm or intending to cause harm to the person',
    '0201': 'Assaults and threats',
    '02011': 'Assault',
    '020111': 'Serious assault',
    '020112': 'Minor assault',
    '02012': 'Threat',
    '020121': 'Serious threat',
    '020122': 'Minor threat',
    '02019': 'Other assaults or threats',
    '0202': 'Acts against liberty',
    '02021': 'Abduction of a minor',
    '020211': 'Parental abduction',
    '020212': 'Abduction by another family member',
    '020213': 'Abduction by a legal guardian',
    '020219': 'Other abduction of a minor',
    '02022': 'Deprivation of liberty',
    '020221': 'Kidnapping',
    '020222': 'Illegal restraint',
    '020223': 'Hijacking',
    '020229': 'Other deprivation of liberty',
    '02029': 'Other acts against liberty',
    '020291': 'Illegal adoption',
    '020292': 'Forced marriage',
    '020299': 'Other acts against liberty',
    '0203': 'Slavery and exploitation',
    '02031': 'Slavery',
    '02032': 'Forced labour',
    '020321': 'Forced labour for domestic services',
    '020322': 'Forced labour for industrial services',
    '020323': 'Forced labour for the State or armed forces',
    '020329': 'Other forced labour',
    '02039': 'Other acts of slavery and exploitation',
    '0204': 'Trafficking in persons (TIP)',
    '02041': 'TIP for sexual exploitation',
    '02042': 'TIP for forced labour or services',
    '02043': 'TIP for organ removal',
    '02044': 'TIP for other purposes',
    '0205': 'Coercion',
    '02051': 'Extortion or blackmail',
    '02059': 'Other acts of coercion',
    '0206': 'Negligence',
    '02061': 'Negligence in situations of persons under care',
    '020611': 'Negligence in situations of children under care',
    '020612': 'Negligence in situations of other dependent persons under care',
    '020619': 'Other negligence in situations of persons under care',
    '02062': 'Professional neglicence',
    '02063': 'Negligence related to driving a vehicle',
    '02069': 'Other acts of negligence',
    '0207': 'Dangerous acts',
    '02071': 'Acts that endanger health',
    '02072': 'Operating a vehicle under the influence of psychoactive substances',
    '020721': 'Operating a vehicle under the influence of alchohol',
    '020722': 'Operating a vehicle under the influence of illicit drugs',
    '020729': 'Operating a vehicle under the influence of other psychoactive substances',
    '02079': 'Other dangerous acts',
    '0208': 'Acts intended to induce fear or emotional distress',
    '02081': 'Harassment',
    '020811': 'Harassment in the workplace',
    '020819': 'Other harassment',
    '02082': 'Stalking',
    '02089': 'Other acts intended to induce fear or emotional distress',
    '0209': 'Defamation or insult',
    '02091': "Defamation or insult due to the victim's characteristics or ascribed attributes",
    '02092': "Defamation or insult due to the victim's ascribed beliefs or values",
    '02099': 'Other defamation or insult',
    '0210': 'Discrimination',
    '02101': 'Personal discrimination',
    '02102': 'Group discrimination',
    '02109': 'Other discrimination',
    '0211': 'Acts that trespass against the person',
    '02111': 'Invasion of privacy',
    '02119': 'Other acts that trespass against the person',
    '0219': 'Other acts causing harm or intending to cause harm to the person',
    '03': 'Injurious acts of sexual nature',
    '0301': 'Sexual violence',
    '03011': 'Rape',
    '030111': 'Rape with force',
    '030112': 'Rape without force',
    '030113': 'Statutory rape',
    '030119': 'Other rape',
    '03012': 'Sexual assault',
    '030121': 'Physical sexual assault',
    '030122': 'Non-physical sexual assault',
    '030129': 'Other sexual assault not elsewhere classified',
    '03019': 'Other acts of sexual violence',
    '0302': 'Sexual exploitation',
    '03021': 'Sexual exploitation of adults',
    '03022': 'Sexual exploitation of children',
    '030221': 'Child pornography',
    '030222': 'Child prostitution',
    '030223': 'Sexual grooming of children',
    '030229': 'Other sexual exploitation of children',
    '03029': 'Other acts of sexual exploitation',
    '0309': 'Other injurious acts of a sexual nature',
    '04': 'Acts against property involving violence or threat against a person',
    '0401': 'Robbery',
    '04011': 'Robbery from the person',
    '040111': 'Robbery from the person in a public location',
    '040112': 'Robbery from the person in a private location',
    '040119': 'Other robbery from the person',
    '04012': 'Robbery of valuable or goods in transit',
    '040121': 'Robbery of a car or vehicle',
    '040129': 'Other robbery of valuables or goods in transit',
    '04013': 'Robbery of an establishment or institution',
    '040131': 'Robbery of a financial instituion',
    '040132': 'Robbery of a non-financial institution',
    '04014': 'Robbery of livestock',
    '04019': 'Other acts of robbery',
    '0409': 'Other acts against property involving violence or threat against a person',
    '05': 'Acts against property only',
    '0501': 'Burglary',
    '05011': 'Burglary of business premises',
    '05012': 'Burglary of private residential premises',
    '050121': 'Burglary of permanent private residences',
    '050122': 'Burglary of non-permanent private residences',
    '05013': 'Burglary of public premises',
    '05019': 'Other acts of burglary',
    '0502': 'Theft',
    '05021': 'Theft of a motorized vehicle or parts thereof',
    '050211': 'Theft of a motorized land vehicle',
    '050212': 'Illegal use of a motorized land vehicle',
    '050213': 'Theft of parts of a motorized land vehicle',
    '050219': 'Other theft of a motorized vehicle or parts thereof',
    '05022': 'Theft of personal property',
    '050221': 'Theft of personal property from a person',
    '050222': 'Theft of personal property from a vehicle',
    '050229': 'Other theft of personal property',
    '05023': 'Theft of business property',
    '050231': 'Theft from a shop',
    '050239': 'Other theft of business property',
    '05024': 'Theft of public property',
    '05025': 'Theft of livestock',
    '05026': 'Theft of services',
    '05029': 'Other acts of theft',
    '0503': 'Intellectual property offences',
    '0504': 'Property damage',
    '05041': 'Damage of public property',
    '05042': 'Damage of personal property',
    '05043': 'Damage of business property',
    '05049': 'Other damage of property',
    '0509': 'Other acts against property only',
    '06': 'Acts involving controlled drugs or other psychoactive substances',
    '0601': 'Unlawful acts involving controlled drugs or precursors',
    '06011':
        'Unlawful possession, purchase, use, cultivation or production of controlled drugs for personal consumption',
    '060111': 'Unlawful possession, purchase or use of controlled drugs for personal consumption',
    '060112': 'Unlawful cultivation or production of controlled drugs for personal consumption',
    '06012':
        'Unlawful trafficking, cultivation or production of controlled drugs or precursors not for personal consumption',
    '060121': 'Unlawful trafficking of controlled drugs not for personal consumption',
    '060122': 'Unlawful manufacture of controlled drugs not for personal consumption',
    '060123': 'Unlawful cultivation of controlled drugs not for personal consumption',
    '060124': 'Unlawful diversion of precursors not for personal consumption',
    '060129':
        'Other unlawful trafficking, cultivation or production of controlled drugs or precursors not for personal consumption',
    '06019': 'Other unlawful acts involving controlled drugs or precursors',
    '0602': 'Unlawful acts involving alcohol, tobacco or other controlled substances',
    '06021': 'Unlawful production, handling, possession or use of alcohol products',
    '060211': 'Unlawful possession or use of alcohol products',
    '060212': 'Unlawful production, trafficking or distribution of alcohol products',
    '060219': 'Other unlawful production, handling, possession or use of alcohol products',
    '06022': 'Unlawful production, handling, possession or use of tobacco products',
    '060221': 'Unlawful possession or use of tobacco products',
    '060222': 'Unlawful production trafficking or distribution of tobacco products',
    '060229': 'Other unlawful production, handling, possession or use of tobacco products',
    '06029': 'Other unlawful acts involving alcohol, tobacco or other controlled substances',
    '0609': 'Other acts involving controlled drugs or other psychoactive substances',
    '07': 'Acts involving fraud, deception or corruption',
    '0701': 'Fraud',
    '07011': 'Financial fraud',
    '070111': 'Financial fraud against the State',
    '070112': 'Financial fraud against natural or legal persons',
    '07019': 'Other acts of fraud',
    '0702': 'Forgery/counterfeiting',
    '07021': 'Counterfeiting means of payment',
    '070211': 'Counterfeiting means of cash payment',
    '070212': 'Counterfeiting means of non-cash payment',
    '07022': 'Counterfeit product offences',
    '07023': 'Acts of forgery/counterfeiting documents',
    '07029': 'Other acts of forgery/counterfeiting',
    '0703': 'Corruption',
    '07031': 'Bribery',
    '070311': 'Active bribery',
    '070312': 'Passive bribery',
    '07032': 'Embezzlement',
    '07033': 'Abuse of functions',
    '07034': 'Trading in influence',
    '07035': 'Illicit enrichment',
    '07039': 'Other acts of corruption',
    '0704': 'Acts involving the proceeds of crime',
    '07041': 'Money laundering',
    '07042': 'Illicit trafficking in cultural property',
    '07049': 'Other acts involving the proceeds of crime',
    '0709': 'Other acts involving fraud, deception or corruption',
    '08': 'Acts against public order, authority and provisions of the State',
    '0801': 'Acts against public order behavioural standards',
    '08011': 'Violent public disorder offences',
    '08012': 'Acts related to social and religious public order norms and standards',
    '08019': 'Other acts against public order behavioural standards',
    '0802': 'Acts against public order sexual standards',
    '08021': 'Prostitution offences',
    '08022': 'Pornography offences',
    '08029': 'Other acts against public order sexual standards',
    '0803': 'Acts related to freedom of expression or control of expression',
    '08031': 'Acts against freedom of expression',
    '08032': 'Acts related to expressions of controlled social beliefs and norms',
    '080321': 'Violations of norms on religious beliefs/views',
    '080322': 'Violations of norms on intolerance and incitement to hatred',
    '080329': 'Other acts related to expressions of controlled social beliefs and norms',
    '08039': 'Other acts related to freedom of expression or control of expression',
    '0804': 'Acts contrary to pubic revenue or regulatory provisions',
    '08041': 'Acts against public revenue provisions',
    '08042': 'Acts against commercial or financial regulations',
    '08043': 'Acts against regulations on betting',
    '08044': 'Smuggling of goods',
    '08045': 'Market manipulations or insider trading',
    '08049': 'Other acts against public administration or regulatory provisions',
    '0805': 'Acts related to migration',
    '08051': 'Smuggling of migrants offences',
    '08059': 'Other unlawful acts related to migration',
    '0806': 'Acts against the justice system',
    '08061': 'Obstruction of justice',
    '08062': 'Breach of justice order',
    '08063': 'Criminal intent',
    '08064': 'Conspiracy',
    '08069': 'Other acts against the justice system',
    '0807': 'Acts related to democratic elections',
    '08071': 'Acts intended to unduly influence voters at elections',
    '08079': 'Other acts related to democratic elections',
    '0808': 'Acts contrary to labour law',
    '08081': 'Collective labour law violations',
    '08082': 'Individual labour law violations',
    '0809': 'Other acts against public order, authority and provisions of the State',
    '09': 'Acts against public safety and state security',
    '0901': 'Acts involving weapons, explosives and other destructive materials',
    '09011': 'Possession or use of weapons and explosives',
    '090111': 'Unlawful possession or use of firearms',
    '090112': 'Unlawful possession or use of other weapons or explosives',
    '090113': 'Unlawful possession or use of chemical, biological or radioactive materials',
    '090119': 'Other acts related to possession or use of weapons and explosives',
    '09012': 'Trafficking of weapons and explosives',
    '090121': 'Trafficking of firearms',
    '090122': 'Trafficking of other weapons or explosives',
    '090123': 'Trafficking of chemical, biological or radioactive materials',
    '090129': 'Other acts related to trafficking of weapons and explosives',
    '09019': 'Other acts relating to weapons and explosives',
    '0902': 'Acts against health and safety',
    '09021': 'Acts against health and safety at work',
    '09029': 'Other acts against health and safety',
    '0903': 'Acts against computer systems',
    '09031': 'Unlawful access to a computer system',
    '09032': 'Unlawful interference with a computer system or computer data',
    '090321': 'Unlawful interference with a computer system',
    '090322': 'Unlawful interference with computer data',
    '09033': 'Unlawful interception or access of computer data',
    '09039': 'Other acts against computer systems',
    '0904': 'Acts against state security',
    '0905': 'Acts related to an organized criminal group',
    '09051': 'Participation in an organized criminal group',
    '09059': 'Other acts related to an organized criminal group',
    '0906': 'Terrorism',
    '09061': 'Participation in a terrorist group',
    '09062': 'Financing of terrorism',
    '09069': 'Other acts related to the activities of a terrorist group',
    '0907': 'Non-injurious traffic violations',
    '0909': 'Other acts against public safety and state security',
    '10': 'Acts against the natural environment',
    '1001': 'Acts that cause environmental pollution or degradation',
    '10011': 'Acts that cause the pollution or degradation of air',
    '10102': 'Acts that cause the pollution or degradation of water',
    '10103': 'Acts that cause the pollution or degradation of soil',
    '10109': 'Other acts that cause environmental pollution or degradation',
    '1002': 'Acts involving the movement or dumping of waste',
    '10021': 'Acts involving the movement or dumping of waste within national borders',
    '10022': 'Acts involving the movement or dumping of waste across national borders',
    '1003': 'Trade or possession of protected or prohibited species of fauna and flora',
    '10031': 'Trade or possession of protected species of wild fauna and flora',
    '100311': 'Trade or possession of protected species within national borders',
    '100312': 'Trade or possession of protected species across national borders',
    '10032': 'Trade or possession of prohibited or controlled species of animals',
    '10039': 'Other trade or possession of proteced or prohibited species of fauna and flora',
    '1004': 'Acts that result in the depletion or degradation of natural resources',
    '10041': 'Illegal logging',
    '10042': 'Illegal hunting, fishing or gathering of wild fauna and flora',
    '10043': 'Illegal mining',
    '10049': 'Other acts that result in the depletion or degradation of natural resources',
    '1009': 'Other acts against the natural environment',
    '10091': 'Acts against animals',
    '10099': 'Other acts against the natural environment',
    '11': 'Other criminal acts not elsewhere classified',
    '1101': 'Acts under universal jurisdiction',
    '11011': 'Torture',
    '11012': 'Piracy',
    '11013': 'War crimes',
    '110131':
        'Unlawfully killing, causing or intending to cause death or serious injury associated with armed conflict',
    '110132': 'Unlawful destruction or damage to property associated with armed conflict',
    '110133': 'Sexual violence associated with armed conflict',
    '110134': 'Acts against liberty or human dignity associated with armed conflict',
    '110135': 'Conscripting or enlisting child soldiers',
    '110139': 'Other war crimes',
    '11014': 'Genocide',
    '11015': 'Crimes against humanity',
    '11016': 'Crime of aggression',
    '11019': 'Other acts under universal jurisdiction',
    '1102': 'Acts contrary to youth regulations and acts on minors',
    '11021': 'Status offences',
    '11029': 'Other acts contrary to youth regulations and acts on minors',
    '1109': 'Other criminal acts not elsewhere classified',
};

interface DataCategory {
    categoryCode: string;
    categoryName: string;
    value: number;
}

interface LocalizedData {
    country: string;
    location: string;
    year: string;
    data: Array<DataCategory>;
}

export interface Comparation {
    countries: Array<LocalizedData>;
}

function getParent(cat: string): string {
    if (cat.length === 2) {
        return '';
    } else if (cat.length > 4) {
        return cat.substring(0, cat.length - 1);
    } else {
        return cat.substring(0, cat.length - 2);
    }
}

function macroCategory(cat: string): string {
    if (cat.length === 2) {
        return cat;
    } else {
        //console.log(getParent(cat));
        return macroCategory(getParent(cat));
    }
}

//// COMPARE USE FUNCTIONS ///////
function mergeByICCS(crimes: Array<Crime>): Array<DataCategory> {
    const output: Array<DataCategory> = [];
    let macroCategories: Array<string> = [];
    for (const crime of crimes) {
        if (crime.ICCS_code) {
            crime.ICCS_code = macroCategory(crime.ICCS_code);
            macroCategories.push(crime.ICCS_code);
        }
    }
    macroCategories = Array.from(new Set(macroCategories));
    for (const category of macroCategories) {
        const value = crimes
            .filter(x => x.ICCS_code === category)
            .map(x => x.value)
            .reduce((acc, x) => acc + x);
        output.push({ categoryCode: category, categoryName: ICCS[category], value: value });
    }
    return output;
}

//levels county, province, region, national
export async function compare(
    countries: string[],
    locations: string[],
    level: string,
    year: string,
): Promise<Comparation> {
    const output: Comparation = { countries: [] };
    const crimes: Array<Array<Crime>> = [];
    //USE NUTS FROM DB HERE
    ///////////////////////////////////
    const sources: Array<Country> = [];
    for (const country of countries) {
        sources.push(await getData(country.toLowerCase()));
    }
    for (let i = 0; i < countries.length; i++) {
        const yearIndex = sources[i].year.map(x => x.year).indexOf(year);
        if (yearIndex === -1) {
            console.log('year not found');
            return { countries: [] };
        }
        if (level === 'national') {
            if (sources[i].year[yearIndex].data) {
                crimes.push(sources[i].year[yearIndex].data);
            } else {
                console.log('national data not found');
                return { countries: [] };
            }
        } else {
            for (const region of sources[i].year[yearIndex].region) {
                if (region.region === locations[i] && level === 'region') {
                    if (region.data) {
                        crimes.push(region.data);
                    } else {
                        console.log('regional data not found');
                        return { countries: [] };
                    }
                }
                for (const province of region.province) {
                    if (province.province === locations[i] && level === 'province') {
                        if (province.data) {
                            crimes.push(province.data);
                        } else {
                            console.log('provincial data not found');
                            return { countries: [] };
                        }
                    }
                    for (const county of province.county) {
                        if (county.county === locations[i] && level === 'county') {
                            crimes.push(county.data);
                        }
                    }
                }
            }
        }
    }
    //////////////////////////////////
    for (let i = 0; i < crimes.length; i++) {
        output.countries.push({
            country: countries[i],
            location: locations[i],
            year: year,
            data: mergeByICCS(crimes[i]),
        });
    }
    return output;
}
