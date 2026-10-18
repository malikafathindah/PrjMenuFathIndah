const fs = require('fs');
const file = 'd:/PROJECT AI/PrjNewMenu/standalone_demo.html';
let content = fs.readFileSync(file, 'utf8');

const regex = /'B5_handling': \{\s*items: \[\s*\{ id: 1, item: 'Biaya Muthowif'.+?\s*\]\s*\}/s;

const replacementStr = `'B5_handling': {
              items: [
                { id: 1, item: 'Biaya Muthowif', unitCost: 300, rateX: 1, calcType: 'muthowwif_fee', isDefault: true },
                { id: 2, item: 'Opr Muthawif', unitCost: 3000000, rateX: 4900, calcType: 'opr_muthawwif_idr', isDefault: true },
                { id: 3, item: 'Beban Kamar Muthowif', unitCost: 305, rateX: 1, calcType: 'beban_kamar_muthowwif', isDefault: true },
                { id: 4, item: 'Handling Makkah fee', unitCost: 85, rateX: 1, calcType: 'standard_sar', isDefault: true },
                { id: 5, item: 'Handling Mekah (By operasional, Snack, cititour 1X dll)', unitCost: 45, rateX: 1, calcType: 'standard_sar', isDefault: true },
                { id: 6, item: 'Handling Madinah + operasional', unitCost: 65, rateX: 1, calcType: 'standard_sar', isDefault: true },
                { id: 7, item: 'Handling Jeddah', unitCost: 40, rateX: 1, calcType: 'standard_sar', isDefault: true },
                { id: 8, item: 'Handling Mekah (By operasional, Nasi box/rresto, potter, check-in, zam2 dll )', unitCost: 65, rateX: 1, calcType: 'standard_sar', isDefault: true },
                { id: 9, item: 'Biaya Operasional Team FathIndah', unitCost: 50, rateX: 3.73, calcType: 'standard_sar', isDefault: true },
                { id: 10, item: 'Biaya Asuransi', unitCost: 160000, rateX: 4900, calcType: 'idr_rate_convert', isDefault: true }
              ]
            }`;

if (regex.test(content)) {
    content = content.replace(regex, replacementStr);
    fs.writeFileSync(file, content);
    console.log("Success standalone_demo");
} else {
    console.log("Regex not matched standalone_demo");
}
