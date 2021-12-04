# -*- coding: utf-8 -*-
"""
Created on Sat Dec  4 16:17:14 2021

@author: Jurek
"""

import csv

sumEat = 0
sumEsat = 0
sumMeat = 0
resultcounter = 0
for i in range(0, 5):
    path = 'dm1_alpha1v' + str(i) + '.csv'
    with open(path) as csvdatei:
        csv_reader_object = csv.DictReader(csvdatei, delimiter=',')
        for row in csv_reader_object:
            sumEat += float(row['EAT']) - float(row['Source Time'])
            sumEsat += float(row['ESAT']) - float(row['Source Time'])
            sumMeat += float(row['MEAT']) - float(row['Source Time'])
            resultcounter += 1


averageEat = sumEat/resultcounter
averageEsat = sumEsat/resultcounter
averageMeat = sumMeat/resultcounter

print(averageEat)
print(averageEsat)
print(averageMeat)