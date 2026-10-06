import {
  Medicine,
  MedicineProduct,
  initializeCatalogueModels,
} from './models.js';

export async function seedCatalogue(environment: string | undefined) {
  if (environment !== 'development')
    throw new Error('Catalogue seed requires development environment');
  await initializeCatalogueModels();
  // Development fixtures only. These examples and fictional brands are not
  // a complete or authoritative drug database or prescribing guidance.
  const examples = [
    {
      genericName: 'paracetamol',
      activeIngredient: 'paracetamol',
      strength: 500,
      strengthUnit: 'mg',
      dosageForm: 'tablet',
      category: 'Example analgesic',
    },
    {
      genericName: 'amoxicillin',
      activeIngredient: 'amoxicillin',
      strength: 500,
      strengthUnit: 'mg',
      dosageForm: 'capsule',
      category: 'Example antibiotic',
    },
    {
      genericName: 'vitamin c',
      activeIngredient: 'ascorbic acid',
      strength: 1000,
      strengthUnit: 'mg',
      dosageForm: 'tablet',
      category: 'Example vitamin',
    },
  ];
  for (const [index, example] of examples.entries()) {
    const identity = {
      genericName: example.genericName,
      strength: example.strength,
      strengthUnit: example.strengthUnit,
      dosageForm: example.dosageForm,
    };
    const medicine =
      (await Medicine.findOne(identity)) ?? (await Medicine.create(example));
    for (const variant of ['A', 'B']) {
      const productCode = `DEMO-MED-${index + 1}-${variant}`;
      const existing = await MedicineProduct.findOne({ productCode });
      if (existing && !existing.medicineId.equals(medicine._id))
        throw new Error('Seed product relationship conflict');
      if (!existing)
        await MedicineProduct.create({
          medicineId: medicine._id,
          brandName: `Fictional ${example.genericName} ${variant}`,
          manufacturer: 'Fictional Example Laboratories',
          packSize: variant === 'A' ? '10 units' : '20 units',
          productCode,
        });
    }
  }
}
