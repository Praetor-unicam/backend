import pandas
import gensim
import re
import json
from gensim.test.utils import common_texts
from gensim.models.doc2vec import Doc2Vec, TaggedDocument
from translate import Translator
from translate.providers import MyMemoryProvider
from iccs_manager import ICCS, MatchedCategory
from sortedcontainers import SortedList

import numpy as np
from scipy import spatial

####### INTERNAL USE FUNCTIONS #########

def print_decorator(source):
    '''
    Used for debugging, this decorator prints the decorated function output
    '''
    def print_output(*args, **kwargs):
        result = source(*args, **kwargs)
        print(result)
        return result
    return print_output


def translate_list(data, source, dest='en'):
    '''
    Translates all elements of [data] from [source] language to [dest] language
    '''
    ret = []
    translator = Translator(provider='mymemory', from_lang = source, to_lang=dest, email='matteo.belenchia@gmail.com')
    for item in data:
        item = translator.translate(item)
        ret.append(item)
        print("*")
    return ret

def write_to_file(filename, data):
    '''
    Writes the JSON encoding of [data] to [filename] path
    '''
    with open(filename, 'w', encoding='utf8') as json_file:
        json.dump(data, json_file, ensure_ascii=False)

def read_file(filename):
    '''
    Loads the JSON content of [filename]
    '''
    return json.loads(open(filename, mode='rb').read().decode('utf-8'))

def avg_feature_vector(sentence, model, num_features, index2word_set):
    words = sentence.split()
    feature_vec = np.zeros((num_features, ), dtype='float32')
    n_words = 0
    for word in words:
        if word in index2word_set:
            n_words += 1
            feature_vec = np.add(feature_vec, model[word])
    if (n_words > 0):
        feature_vec = np.divide(feature_vec, n_words)
        return feature_vec
    else:
        return np.array([])    


######## COUNTRY SPECIFIC FUNCTIONS ###############
# used to remember regular expressions used and additional info

def austria_processor(data):
    austria_tmp = []
    i = 0
    for crime in data:
        if "Annotations" not in crime:
            crime = re.sub(r'\<.*\>', '', crime).strip()
            austria_tmp.append(crime)
            print(i)
            i = i + 1
    return austria_tmp

def germany_processor(data):
    '''
    english translation from different table than data! might not correspond
    needs a check because important info might have been cut
    '''
    germany_tmp = []
    i = 0
    for crime in data:
        crime = re.sub(r'\(.*\)', '', crime).strip()
        germany_tmp.append(crime)
        print(i)
        i = i + 1
    return germany_tmp

def luxembourg_processor(data):
    return data

def hungary_processor(data):
    return data

def czech_processor(data):
    return data

def nederland_processor(data):
    data = [ re.sub(r'[0-9](\.[0-9])*', '', elem).strip() for elem in data ]
    return data

def spain_processor(data):
    data = [ re.sub(r'[0-9]*(\.[0-9])*(\.-)*', '', elem).strip() for elem in data ]
    return data

def denmark_processor(data):
    data_new = []
    for item in data:
        if 'Repealed' in item:
            continue
        elif 'New' in item:
            data_new.append(re.sub('\(.*\)', '', item).strip())
        else:
            data_new.append(item)
    return data_new

def portugal_processor(data):
    return data

def poland_processor(data):
    return data

def bulgaria_processor(data):
    '''
    explanation of categories:
    https://www.nsi.bg/en/content/6247/crimes-chapters-penal-code-and-some-kind-crimes-and-according-results-proceedings
    '''
    return data

def cyprus_processor(data):
    '''
    serious crime + minor offences
    '''
    return data

def italy_processor(data):
    return data

def france_processor(data):
    '''
    removed 4 unused indexes
    '''
    return data

def northern_ireland_processor(data):
    '''
    check for nested categories, cant find provincial data
    '''
    return data

def england_processor(data):
    return data

def finland_processor(data):
    '''
    too complex for R.E.
    '''
    return data

def belgium_processor(data):
    return data

####### PUBLIC USE FUNCTIONS ##########

def match_list(data):
    '''
    Matches labels in [data] to ICCS categories using avg_feature_vector
    '''
    model = gensim.models.KeyedVectors.load_word2vec_format('../data/model/GoogleNews-vectors-negative300.bin', binary=True)
    index2word_set = set(model.index2word)
    best_matching = dict.fromkeys(data)
    print("done loading model...")
    for crime in data:
        print("Matching crime category: " + crime)
        crime_vec = avg_feature_vector(crime, model=model, num_features=300, index2word_set=index2word_set)
        similarity_ranking = SortedList(key= lambda x: x.get_similarity())
        if crime_vec.size == 0:
            best_matching[crime] = [MatchedCategory("", "", 0)]
            continue
        for code in ICCS:
            name = ICCS[code]
            potential_vec = avg_feature_vector(name, model=model, num_features=300, index2word_set=index2word_set)
            if potential_vec.size == 0:
                continue
            similarity = 1 - spatial.distance.cosine(crime_vec, potential_vec)
            matching = MatchedCategory(code, name, similarity)
            similarity_ranking.add(matching)
        best_matching[crime] = list(reversed(similarity_ranking[-5:]))

    for key in best_matching:
        best_matching[key] = (best_matching[key][0].get_code(), best_matching[key][0].get_name())

    return json.dumps(best_matching)

def save_matching(country, data):
    '''
    Saves the matching contained in [data] to [filename]
    '''
    with open('../data/matching/'+country+'/'+country+'-matching.txt', 'w', encoding='utf8') as json_file:
        json_file.write(data)

if __name__ == '__main__':
    data = read_file('../data/matching/bulgaria/bulgaria-translated.txt') # data might also be a function call
    # or data = getCrimeCategories('country')
    result = match_list(data)
    save_matching('bulgaria', result)
