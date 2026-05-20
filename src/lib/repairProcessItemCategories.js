const categoryOptionsByProcessType = {
  in_house: [
    "Collision / Structural Damage",
    "Cosmetic / Paint Repair",
    "Electrical Repair",
    "Water Damage",
    "Mechanical Repair",
    "Interior Repair",
    "Detailing",
    "Other",
  ],
  third_party: [
    "Body Shop Repair",
    "Mechanical Shop Repair",
    "Electrical Specialist",
    "Paint Shop",
    "Alignment / Suspension Shop",
    "Glass Repair",
    "Other",
  ],
  parts_accessories: [
    "Replacement Part",
    "Accessory",
    "Key / Remote",
    "Tires / Wheels",
    "Battery",
    "Interior Accessory",
    "Exterior Accessory",
    "Other",
  ],
};

export function getRepairProcessItemCategoryOptions(processType) {
  return (
    categoryOptionsByProcessType[processType] ??
    categoryOptionsByProcessType.in_house
  );
}

export function getDefaultRepairProcessItemCategory(processType) {
  return getRepairProcessItemCategoryOptions(processType)[0];
}

export function getRepairProcessItemCategoryFormData(
  categoryName,
  processType
) {
  const categoryOptions = getRepairProcessItemCategoryOptions(processType);

  if (!categoryName) {
    return {
      category_name: getDefaultRepairProcessItemCategory(processType),
      custom_category_name: "",
    };
  }

  if (categoryOptions.includes(categoryName)) {
    return {
      category_name: categoryName,
      custom_category_name: "",
    };
  }

  return {
    category_name: "Other",
    custom_category_name: categoryName,
  };
}
