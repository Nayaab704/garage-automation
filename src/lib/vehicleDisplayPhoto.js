export function getVehiclePrimaryPhoto(vehicle, vehiclePhotos = []) {
  const primaryPhotoId = vehicle?.primary_photo_id;

  if (!primaryPhotoId) {
    return null;
  }

  const primaryPhoto = vehiclePhotos.find(
    (photo) => photo?.id === primaryPhotoId
  );

  return primaryPhoto?.photo_url ? primaryPhoto : null;
}

export function buildVehiclePrimaryPhotoMap(vehicles = [], vehiclePhotos = []) {
  const photosById = new Map(
    vehiclePhotos
      .filter((photo) => photo?.id && photo?.photo_url)
      .map((photo) => [photo.id, photo])
  );

  return vehicles.reduce((photoMap, vehicle) => {
    const primaryPhoto = photosById.get(vehicle?.primary_photo_id);

    if (vehicle?.id && primaryPhoto) {
      photoMap[vehicle.id] = primaryPhoto;
    }

    return photoMap;
  }, {});
}
