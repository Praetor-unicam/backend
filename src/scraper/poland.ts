import axios, { AxiosResponse } from 'axios';

const api_url = 'https://bdl.stat.gov.pl/api/v1';
const crime_subject_id = 'P2290';

const headers = {'X-ClientId': process.env.POLAND_KEY}

interface VariableRequestData {
    id: number,
    subjectId: string,
    n1: string,
    level: number,
    measureUnitId: number,
    measureUnitName: string
}


const requestVariables = async () => {
    const params = {
        'subject-id': crime_subject_id,
        'format':'JSON',
        'lang':'en'
    }

    const request = await axios.get(api_url + '/variables',{ params, headers });

    if(request.status !== 200)
        throw "Upstream broken";

    return request.data;
}

export const getVariables = async () => {
    let variables: string[] = [];

    let variablesRequestData = await requestVariables();

    let cycleVariables: string[] = variablesRequestData.results.map((data: VariableRequestData) => data.n1);
    variables = [...variables, ...cycleVariables];

    while (variablesRequestData['links'].hasOwnProperty('next')) {
        const request = await axios.get(variablesRequestData['links']['next'], {headers});
        variablesRequestData = request.data;
        cycleVariables = variablesRequestData.results.map((data: VariableRequestData) => data.n1);
        variables = [...variables, ...cycleVariables];
    }

    return variables;
}

const requestData = async (varId: string, year: number, level: number) => {
    const params = {
        'year': year,
        'unit-level': level,
        'lang': 'en',
        'format': 'JSON'
    }

    const request = await axios.get(api_url + '/data/by-variable/' + varId, { params, headers });

    if(request.status !== 200)
        throw "Upstream broken";
        
    return request.data;
}

