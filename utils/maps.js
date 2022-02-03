// const commonPlantNamesArray = ['raspberry', 'garlic', 'herb Robert', 'field scabious', 'henna', 'elderberry', 'comfrey', 'marigold', 'common hollyhock', 'neem', 'clover', 'passion fruit', 'bergamot orange', 'cicely', 'acorn', 'rhodiola'];
// const commonPlantEdibalityArray = ['e', 'e', 'i', 'i', 'i', 't', 't', 'e', 'i', 'i', 'e', 'e', 'e', 'e', 'e', 'e'];
// const commonPlantHealsWoundsArray = [false, false, true, true, false, false, false, true, false, false, false, false, true, false, false, false];
// const commonPlantHealsInfectionsArray = [false, false, false, false, true, true, true, false, true, true, false, false, false, false, false, false];
// const commonPlantHealsColdsArray = [true, true, false, false, false, false, false, false, false, false, true, false, false, true, false, false];
// const commonPlantHealsSprainsArray = [false, false, false, false, false, false, false, false, false, false, false, true, false, false, true, false];
// const commonPlantHealsPoisonArray = [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false];

// const commonPlantGivesEnergyArray = [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, true];

// const commonPlantDescriptionsArray = [];

// commonPlantDescriptionsArray[0] = 'A tasty berry! Good for the quick hunger, and helps fight common colds as well.';
// commonPlantDescriptionsArray[1] = 'A flowering plant in the onion genus. Nourishing and good against colds.';
// commonPlantDescriptionsArray[2] = 'The herb Robert is a common species of plants useful for healing wounds.';
// commonPlantDescriptionsArray[3] = 'This pretty flower is used to fight wounds.';
// commonPlantDescriptionsArray[4] = 'A flowering plant often used as dye, but also used against infections, bruises and swelling.';
// commonPlantDescriptionsArray[5] = 'This berry is poisonous when uncooked, but it helps against infections when used as a medicine.';
// commonPlantDescriptionsArray[6] = 'Comfrey is a flowering plant that is toxic when eaten, but heals infections when applied directly.';
// commonPlantDescriptionsArray[7] = 'This flowering plant is not only tasty, but also able to heal wounds.';
// commonPlantDescriptionsArray[8] = 'A flower frequently used to fight infections and inflammations.';
// commonPlantDescriptionsArray[9] = 'As a tree in the mahogany family, this is not a good foodsource, but it can be processed to help with infections.';
// commonPlantDescriptionsArray[10] = 'Several plants of the genus Trifolium. A common source of nourishment, and healing for coughs and colds.';
// commonPlantDescriptionsArray[11] = 'Vine species of the passion flower. Very nutritious, its minerals even help fight sprains.';
// commonPlantDescriptionsArray[12] = 'A citrus fruit the size of an orange. Its fluids have a healing effect on wounds.';
// commonPlantDescriptionsArray[13] = 'This plant grows 6ft 6in (2m) high. Both the leaves and the roots are edible, and it\'s effective against coughs and colds.';
// commonPlantDescriptionsArray[14] = 'This nut is highly nutritious and therefore serves as an excellent source of food, and can even help fight sprains.';
// commonPlantDescriptionsArray[15] = 'The root of a perennial plant, searched after as a food source and for its ability to help fight fatigue and exhaustion.';

const commonPlantMap = new Map();

commonPlantMap.set('raspberry', {
	name: 'raspberry',
	description: 'A tasty berry! Good for the quick hunger, and helps fight common colds as well.',
	edibality: 'e',
	healsWounds: false,
	healsInfections: false,
	healsColds: true,
	healsSprains: false,
	healsPoison: false,
	givesEnergy: false,
});

commonPlantMap.set('garlic', {
	name: 'garlic',
	description: 'A flowering plant in the onion genus. Nourishing and good against colds.',
	edibality: 'e',
	healsWounds: false,
	healsInfections: false,
	healsColds: true,
	healsSprains: false,
	healsPoison: false,
	givesEnergy: false,
});

commonPlantMap.set('herb Robert', {
	name: 'herb Robert',
	description: 'The herb Robert is a common species of plants useful for healing wounds.',
	edibality: 'i',
	healsWounds: true,
	healsInfections: false,
	healsColds: false,
	healsSprains: false,
	healsPoison: false,
	givesEnergy: false,
});

commonPlantMap.set('field scabious', {
	name: 'field scabious',
	description: 'This pretty flower is used to fight wounds.',
	edibality: 'i',
	healsWounds: true,
	healsInfections: false,
	healsColds: false,
	healsSprains: false,
	healsPoison: false,
	givesEnergy: false,
});

commonPlantMap.set('henna', {
	name: 'henna',
	description: 'A flowering plant often used as dye, but also used against infections, bruises and swelling.',
	edibality: 'i',
	healsWounds: false,
	healsInfections: true,
	healsColds: false,
	healsSprains: false,
	healsPoison: false,
	givesEnergy: false,
});

commonPlantMap.set('elderberry', {
	name: 'elderberry',
	description: 'This berry is poisonous when uncooked, but it helps against infections when used as a medicine.',
	edibality: 't',
	healsWounds: false,
	healsInfections: true,
	healsColds: false,
	healsSprains: false,
	healsPoison: false,
	givesEnergy: false,
});

commonPlantMap.set('comfrey', {
	name: 'comfrey',
	description: 'Comfrey is a flowering plant that is toxic when eaten, but heals infections when applied directly.',
	edibality: 't',
	healsWounds: false,
	healsInfections: true,
	healsColds: false,
	healsSprains: false,
	healsPoison: false,
	givesEnergy: false,
});

commonPlantMap.set('marigold', {
	name: 'marigold',
	description: 'This flowering plant is not only tasty, but also able to heal wounds.',
	edibality: 'e',
	healsWounds: true,
	healsInfections: false,
	healsColds: false,
	healsSprains: false,
	healsPoison: false,
	givesEnergy: false,
});

commonPlantMap.set('common hollyhock', {
	name: 'common hollyhock',
	description: 'A flower frequently used to fight infections and inflammations.',
	edibality: 'i',
	healsWounds: false,
	healsInfections: true,
	healsColds: false,
	healsSprains: false,
	healsPoison: false,
	givesEnergy: false,
});

commonPlantMap.set('neem', {
	name: 'neem',
	description: 'As a tree in the mahogany family, this is not a good foodsource, but it can be processed to help with infections.',
	edibality: 'i',
	healsWounds: false,
	healsInfections: true,
	healsColds: false,
	healsSprains: false,
	healsPoison: false,
	givesEnergy: false,
});

commonPlantMap.set('clover', {
	name: 'clover',
	description: 'Several plants of the genus Trifolium. A common source of nourishment, and healing for coughs and colds.',
	edibality: 'e',
	healsWounds: false,
	healsInfections: false,
	healsColds: true,
	healsSprains: false,
	healsPoison: false,
	givesEnergy: false,
});

commonPlantMap.set('passion fruit', {
	name: 'passion fruit',
	description: 'Vine species of the passion flower. Very nutritious, its minerals even help fight sprains.',
	edibality: 'e',
	healsWounds: false,
	healsInfections: false,
	healsColds: false,
	healsSprains: true,
	healsPoison: false,
	givesEnergy: false,
});

commonPlantMap.set('bergamot orange', {
	name: 'bergamot orange',
	description: 'A citrus fruit the size of an orange. Its fluids have a healing effect on wounds.',
	edibality: 'e',
	healsWounds: true,
	healsInfections: false,
	healsColds: false,
	healsSprains: false,
	healsPoison: false,
	givesEnergy: false,
});

commonPlantMap.set('cicely', {
	name: 'cicely',
	description: 'This plant grows 6ft 6in (2m) high. Both the leaves and the roots are edible, and it\'s effective against coughs and colds.',
	edibality: 'e',
	healsWounds: false,
	healsInfections: false,
	healsColds: true,
	healsSprains: false,
	healsPoison: false,
	givesEnergy: false,
});

commonPlantMap.set('acorn', {
	name: 'acorn',
	description: 'This nut is highly nutritious and therefore serves as an excellent source of food, and can even help fight sprains.',
	edibality: 'e',
	healsWounds: false,
	healsInfections: false,
	healsColds: false,
	healsSprains: true,
	healsPoison: false,
	givesEnergy: false,
});

commonPlantMap.set('rhodiola', {
	name: 'rhodiola',
	description: 'The root of a perennial plant, searched after as a food source and for its ability to help fight fatigue and exhaustion.',
	edibality: 'e',
	healsWounds: false,
	healsInfections: false,
	healsColds: false,
	healsSprains: false,
	healsPoison: false,
	givesEnergy: true,
});


// const uncommonPlantNamesArray = ['solomon\'s seal', 'gotu kola', 'great mullein', 'purple coneflower', 'field horsetail', 'bay laurel', 'chick weed', 'yerba mate'];
// const uncommonPlantEdibalityArray = ['e', 'e', 'e', 'e', 't', 'e', 'e', 'e'];
// const uncommonPlantHealsWoundsArray = [true, true, false, false, true, true, true, false];
// const uncommonPlantHealsInfectionsArray = [false, false, false, false, false, false, false, false];
// const uncommonPlantHealsColdsArray = [false, false, true, true, false, false, false, false];
// const uncommonPlantHealsSprainsArray = [true, false, true, true, true, true, true, true];
// const uncommonPlantHealsPoisonArray = [false, false, false, false, false, false, false, false];

// const uncommonPlantGivesEnergyArray = [false, true, false, false, false, false, false, true];

// const uncommonPlantDescriptionsArray = [];

// uncommonPlantDescriptionsArray[0] = 'This flowering plant is a great source of food, but also excellent for healing sprains as well as wounds!';
// uncommonPlantDescriptionsArray[1] = 'A vegetable often used to treat wounds, as well as being very energizing!';
// uncommonPlantDescriptionsArray[2] = 'The great mullein is a high growing biennal plant not only used for consumption but also for colds and sprains.';
// uncommonPlantDescriptionsArray[3] = 'This flower is not only part of the sunflower family, but also a treatment against, sprains, colds, and hunger!';
// uncommonPlantDescriptionsArray[4] = 'A perenniel plant that is useful against wounds and sprains, but toxic if consumed.';
// uncommonPlantDescriptionsArray[5] = 'An aromatic large shrub used to treat wounds and sprains!';
// uncommonPlantDescriptionsArray[6] = 'The chick weed is not only very tasty, but also able to heal wounds and sprains.';
// uncommonPlantDescriptionsArray[7] = 'This plants leaves are useful for healing sprains, but also energizing due to it containing caffeine.';

const uncommonPlantMap = new Map();

uncommonPlantMap.set('solomon\'s seal', {
	name: 'solomon\'s seal',
	description: 'This flowering plant is a great source of food, but also excellent for healing sprains as well as wounds!',
	edibality: 'e',
	healsWounds: true,
	healsInfections: false,
	healsColds: false,
	healsSprains: true,
	healsPoison: false,
	givesEnergy: false,
});

uncommonPlantMap.set('gotu kola', {
	name: 'gotu kola',
	description: 'A vegetable often used to treat wounds, as well as being very energizing!',
	edibality: 'e',
	healsWounds: true,
	healsInfections: false,
	healsColds: false,
	healsSprains: false,
	healsPoison: false,
	givesEnergy: true,
});

uncommonPlantMap.set('great mullein', {
	name: 'great mullein',
	description: 'The great mullein is a high growing biennal plant not only used for consumption but also for colds and sprains.',
	edibality: 'e',
	healsWounds: false,
	healsInfections: false,
	healsColds: true,
	healsSprains: true,
	healsPoison: false,
	givesEnergy: false,
});

uncommonPlantMap.set('purple coneflower', {
	name: 'purple coneflower',
	description: 'This flower is not only part of the sunflower family, but also a treatment against, sprains, colds, and hunger!',
	edibality: 'e',
	healsWounds: false,
	healsInfections: false,
	healsColds: true,
	healsSprains: true,
	healsPoison: false,
	givesEnergy: false,
});

uncommonPlantMap.set('field horsetail', {
	name: 'field horsetail',
	description: 'A perenniel plant that is useful against wounds and sprains, but toxic if consumed.',
	edibality: 't',
	healsWounds: true,
	healsInfections: false,
	healsColds: false,
	healsSprains: true,
	healsPoison: false,
	givesEnergy: false,
});

uncommonPlantMap.set('bay laurel', {
	name: 'bay laurel',
	description: 'An aromatic large shrub used to treat wounds and sprains!',
	edibality: 'e',
	healsWounds: true,
	healsInfections: false,
	healsColds: false,
	healsSprains: true,
	healsPoison: false,
	givesEnergy: false,
});

uncommonPlantMap.set('chick weed', {
	name: 'chick weed',
	description: 'The chick weed is not only very tasty, but also able to heal wounds and sprains.',
	edibality: 'e',
	healsWounds: true,
	healsInfections: false,
	healsColds: false,
	healsSprains: true,
	healsPoison: false,
	givesEnergy: false,
});

uncommonPlantMap.set('yerba mate', {
	name: 'yerba mate',
	description: 'This plants leaves are useful for healing sprains, but also energizing due to it containing caffeine.',
	edibality: 'e',
	healsWounds: false,
	healsInfections: false,
	healsColds: false,
	healsSprains: true,
	healsPoison: false,
	givesEnergy: true,
});


// const rarePlantNamesArray = ['ribwort plantain', 'charcoal-tree leaves', 'marsh mallow'];
// const rarePlantEdibalityArray = ['e', 'e', 'e'];
// const rarePlantHealsWoundsArray = [false, true, true];
// const rarePlantHealsInfectionsArray = [false, false, false];
// const rarePlantHealsColdsArray = [true, true, true];
// const rarePlantHealsSprainsArray = [true, false, true];
// const rarePlantHealsPoisonArray = [true, true, false];

// const rarePlantGivesEnergyArray = [false, false, false];

// const rarePlantDescriptionsArray = [];

// rarePlantDescriptionsArray[0] = 'A weed for treating sprains, colds and poison! Highly nutritious.';
// rarePlantDescriptionsArray[1] = 'These leaves do wonders against poison, wounds and colds, as well as being very tasty.';
// rarePlantDescriptionsArray[2] = 'This sweet tasting plant is very effective against colds, sprains and wounds!';

const rarePlantMap = new Map();

rarePlantMap.set('ribwort plantain', {
	name: 'ribwort plantain',
	description: 'A weed for treating sprains, colds and poison! Highly nutritious.',
	edibality: 'e',
	healsWounds: false,
	healsInfections: false,
	healsColds: true,
	healsSprains: true,
	healsPoison: true,
	givesEnergy: false,
});

rarePlantMap.set('charcoal-tree leaves', {
	name: 'charcoal-tree leaves',
	description: 'These leaves do wonders against poison, wounds and colds, as well as being very tasty.',
	edibality: 'e',
	healsWounds: true,
	healsInfections: false,
	healsColds: true,
	healsSprains: false,
	healsPoison: true,
	givesEnergy: false,
});

rarePlantMap.set('marsh mallow', {
	name: 'marsh mallow',
	description: 'This sweet tasting plant is very effective against colds, sprains and wounds!',
	edibality: 'e',
	healsWounds: true,
	healsInfections: false,
	healsColds: true,
	healsSprains: true,
	healsPoison: false,
	givesEnergy: false,
});


// const nameArray = [];
// const dietArray = [];
// const habitatArray = [];
// let biome1OpponentsArray = [];
// let biome2OpponentsArray = [];
// let biome3OpponentsArray = [];

const speciesMap = new Map();

// nameArray[0] = 'wolf';
// dietArray[0] = 'carnivore';
// habitatArray[0] = 'cold';
// if (profileData && profileData.species == nameArray[0]) {
// 	biome1OpponentsArray = ['rabbit', 'squirrel', 'deer'];
// 	biome2OpponentsArray = ['fox', 'dog'];
// 	biome3OpponentsArray = ['bear', 'horse', 'elk'];
// }

speciesMap.set('wolf', {
	name: 'wolf',
	diet: 'carnivore',
	habitat: 'cold',
	biome1OpponentArray: ['rabbit', 'squirrel', 'deer'],
	biome2OpponentArray: ['fox', 'dog', 'goat'],
	biome3OpponentArray: ['bear', 'horse', 'elk'],
});

// nameArray[1] = 'cat';
// dietArray[1] = 'carnivore';
// habitatArray[1] = 'cold';
// if (profileData && profileData.species == nameArray[1]) {
// 	biome1OpponentsArray = ['rabbit', 'squirrel', 'owl'];
// 	biome2OpponentsArray = ['fox', 'bear'];
// 	biome3OpponentsArray = ['wolf', 'dog'];
// }

speciesMap.set('cat', {
	name: 'cat',
	diet: 'carnivore',
	habitat: 'cold',
	biome1OpponentArray: ['rabbit', 'squirrel', 'owl'],
	biome2OpponentArray: ['fox', 'bear'],
	biome3OpponentArray: ['wolf', 'dog'],
});

// nameArray[2] = 'fox';
// dietArray[2] = 'omnivore';
// habitatArray[2] = 'cold';
// if (profileData && profileData.species == nameArray[2]) {
// 	biome1OpponentsArray = ['rabbit', 'squirrel', 'owl'];
// 	biome2OpponentsArray = ['cat', 'dog', 'deer'];
// 	biome3OpponentsArray = ['wolf', 'bear'];
// }

speciesMap.set('fox', {
	name: 'fox',
	diet: 'omnivore',
	habitat: 'cold',
	biome1OpponentArray: ['rabbit', 'squirrel', 'owl'],
	biome2OpponentArray: ['cat', 'dog', 'deer'],
	biome3OpponentArray: ['wolf', 'bear'],
});

// nameArray[3] = 'leopard';
// dietArray[3] = 'carnivore';
// habitatArray[3] = 'warm';
// if (profileData && profileData.species == nameArray[3]) {
// 	biome1OpponentsArray = ['coyote', 'maned wolf'];
// 	biome2OpponentsArray = ['caracal'];
// 	biome3OpponentsArray = ['tiger', 'lion'];
// }

speciesMap.set('leopard', {
	name: 'leopard',
	diet: 'carnivore',
	habitat: 'warm',
	biome1OpponentArray: ['coyote', 'maned wolf'],
	biome2OpponentArray: ['caracal'],
	biome3OpponentArray: ['tiger', 'lion'],
});

// nameArray[4] = 'tiger';
// dietArray[4] = 'carnivore';
// habitatArray[4] = 'warm';
// if (profileData && profileData.species == nameArray[4]) {
// 	biome1OpponentsArray = ['coyote', 'maned wolf'];
// 	biome2OpponentsArray = ['leopard', 'caracal'];
// 	biome3OpponentsArray = ['lion'];
// }

speciesMap.set('tiger', {
	name: 'tiger',
	diet: 'carnivore',
	habitat: 'warm',
	biome1OpponentArray: ['coyote', 'maned wolf'],
	biome2OpponentArray: ['leopard', 'caracal'],
	biome3OpponentArray: ['lion'],
});

// nameArray[5] = 'shark';
// dietArray[5] = 'carnivore';
// habitatArray[5] = 'water';
// if (profileData && profileData.species == nameArray[5]) {
// 	biome1OpponentsArray = ['salmon', 'tuna', 'squid'];
// 	biome2OpponentsArray = ['seal', 'crab'];
// 	biome3OpponentsArray = ['orca', 'humpback whale'];
// }

speciesMap.set('shark', {
	name: 'shark',
	diet: 'carnivore',
	habitat: 'water',
	biome1OpponentArray: ['salmon', 'tuna', 'squid'],
	biome2OpponentArray: ['seal', 'crab'],
	biome3OpponentArray: ['orca', 'humpback whale'],
});

// nameArray[6] = 'caracal';
// dietArray[6] = 'carnivore';
// habitatArray[6] = 'warm';
// if (profileData && profileData.species == nameArray[6]) {
// 	biome1OpponentsArray = ['coyote', 'maned wolf'];
// 	biome2OpponentsArray = ['leopard', 'tiger'];
// 	biome3OpponentsArray = ['lion'];
// }

speciesMap.set('caracal', {
	name: 'caracal',
	diet: 'carnivore',
	habitat: 'warm',
	biome1OpponentArray: ['coyote', 'maned wolf'],
	biome2OpponentArray: ['leopard', 'tiger'],
	biome3OpponentArray: ['lion'],
});

// nameArray[7] = 'bear';
// dietArray[7] = 'omnivore';
// habitatArray[7] = 'cold';
// if (profileData && profileData.species == nameArray[7]) {
// 	biome1OpponentsArray = ['rabbit', 'squirrel', 'salmon', 'tuna'];
// 	biome2OpponentsArray = ['cat', 'fox', 'dog'];
// 	biome3OpponentsArray = ['wolf', 'horse', 'elk'];
// }

speciesMap.set('bear', {
	name: 'bear',
	diet: 'omnivore',
	habitat: 'cold',
	biome1OpponentArray: ['rabbit', 'squirrel', 'salmon', 'tuna'],
	biome2OpponentArray: ['cat', 'fox', 'dog'],
	biome3OpponentArray: ['wolf', 'horse', 'elk'],
});

// nameArray[8] = 'coyote';
// dietArray[8] = 'omnivore';
// habitatArray[8] = 'warm';
// if (profileData && profileData.species == nameArray[8]) {
// 	biome1OpponentsArray = ['caracal', 'maned wolf'];
// 	biome2OpponentsArray = ['leopard'];
// 	biome3OpponentsArray = ['tiger', 'lion'];
// }

speciesMap.set('coyote', {
	name: 'coyote',
	diet: 'omnivore',
	habitat: 'warm',
	biome1OpponentArray: ['caracal', 'maned wolf'],
	biome2OpponentArray: ['leopard', 'goat'],
	biome3OpponentArray: ['tiger', 'lion'],
});

// nameArray[9] = 'rabbit';
// dietArray[9] = 'herbivore';
// habitatArray[9] = 'cold';
// if (profileData && profileData.species == nameArray[9]) {
// 	biome1OpponentsArray = ['squirrel', 'owl'];
// 	biome2OpponentsArray = ['dog', 'deer'];
// 	biome3OpponentsArray = ['wolf', 'cat', 'bear'];
// }

speciesMap.set('rabbit', {
	name: 'rabbit',
	diet: 'herbivore',
	habitat: 'cold',
	biome1OpponentArray: ['squirrel', 'owl'],
	biome2OpponentArray: ['dog', 'deer'],
	biome3OpponentArray: ['wolf', 'cat', 'bear'],
});

// nameArray[10] = 'squirrel';
// dietArray[10] = 'omnivore';
// habitatArray[10] = 'cold';
// if (profileData && profileData.species == nameArray[10]) {
// 	biome1OpponentsArray = ['rabbit', 'owl'];
// 	biome2OpponentsArray = ['dog', 'deer'];
// 	biome3OpponentsArray = ['wolf', 'cat', 'bear'];
// }

speciesMap.set('squirrel', {
	name: 'squirrel',
	diet: 'omnivore',
	habitat: 'cold',
	biome1OpponentArray: ['rabbit', 'owl'],
	biome2OpponentArray: ['dog', 'deer'],
	biome3OpponentArray: ['wolf', 'cat', 'bear'],
});

// nameArray[11] = 'lion';
// dietArray[11] = 'carnivore';
// habitatArray[11] = 'warm';
// if (profileData && profileData.species == nameArray[11]) {
// 	biome1OpponentsArray = ['coyote', 'maned wolf'];
// 	biome2OpponentsArray = ['leopard', 'caracal'];
// 	biome3OpponentsArray = ['tiger'];
// }

speciesMap.set('lion', {
	name: 'lion',
	diet: 'carnivore',
	habitat: 'warm',
	biome1OpponentArray: ['coyote', 'maned wolf'],
	biome2OpponentArray: ['leopard', 'caracal'],
	biome3OpponentArray: ['tiger'],
});

// nameArray[12] = 'seal';
// dietArray[12] = 'carnivore';
// habitatArray[12] = 'water';
// if (profileData && profileData.species == nameArray[12]) {
// 	biome1OpponentsArray = ['salmon', 'tuna', 'squid'];
// 	biome2OpponentsArray = ['bear', 'crab'];
// 	biome3OpponentsArray = ['shark', 'orca'];
// }

speciesMap.set('seal', {
	name: 'seal',
	diet: 'carnivore',
	habitat: 'water',
	biome1OpponentArray: ['salmon', 'tuna', 'squid'],
	biome2OpponentArray: ['bear', 'crab'],
	biome3OpponentArray: ['shark', 'orca'],
});

// nameArray[13] = 'salmon';
// dietArray[13] = 'carnivore';
// habitatArray[13] = 'water';
// if (profileData && profileData.species == nameArray[13]) {
// 	biome1OpponentsArray = ['squid'];
// 	biome2OpponentsArray = ['crab'];
// 	biome3OpponentsArray = ['bear', 'seal', 'owl'];
// }

speciesMap.set('salmon', {
	name: 'salmon',
	diet: 'carnivore',
	habitat: 'water',
	biome1OpponentArray: ['squid'],
	biome2OpponentArray: ['crab'],
	biome3OpponentArray: ['bear', 'seal', 'owl'],
});

// nameArray[14] = 'tuna';
// dietArray[14] = 'carnivore';
// habitatArray[14] = 'water';
// if (profileData && profileData.species == nameArray[14]) {
// 	biome1OpponentsArray = ['salmon', 'squid'];
// 	biome2OpponentsArray = ['crab'];
// 	biome3OpponentsArray = ['bear', 'seal', 'owl'];
// }

speciesMap.set('tuna', {
	name: 'tuna',
	diet: 'carnivore',
	habitat: 'water',
	biome1OpponentArray: ['salmon', 'squid'],
	biome2OpponentArray: ['crab'],
	biome3OpponentArray: ['bear', 'seal', 'owl'],
});

// nameArray[15] = 'squid';
// dietArray[15] = 'carnivore';
// habitatArray[15] = 'water';
// if (profileData && profileData.species == nameArray[15]) {
// 	biome1OpponentsArray = ['crab'];
// 	biome2OpponentsArray = ['tuna', 'salmon'];
// 	biome3OpponentsArray = ['shark', 'seal', 'owl'];
// }

speciesMap.set('squid', {
	name: 'squid',
	diet: 'carnivore',
	habitat: 'water',
	biome1OpponentArray: ['crab'],
	biome2OpponentArray: ['tuna', 'salmon'],
	biome3OpponentArray: ['shark', 'seal', 'owl'],
});

// nameArray[16] = 'crab';
// dietArray[16] = 'omnivore';
// habitatArray[16] = 'water';
// if (profileData && profileData.species == nameArray[16]) {
// 	biome1OpponentsArray = ['squid'];
// 	biome2OpponentsArray = ['tuna', 'salmon'];
// 	biome3OpponentsArray = ['bear', 'seal', 'owl'];
// }

speciesMap.set('crab', {
	name: 'crab',
	diet: 'omnivore',
	habitat: 'water',
	biome1OpponentArray: ['squid'],
	biome2OpponentArray: ['tuna', 'salmon'],
	biome3OpponentArray: ['bear', 'seal', 'owl'],
});

// nameArray[17] = 'orca';
// dietArray[17] = 'carnivore';
// habitatArray[17] = 'water';
// if (profileData && profileData.species == nameArray[17]) {
// 	biome1OpponentsArray = ['salmon', 'tuna', 'squid'];
// 	biome2OpponentsArray = ['seal', 'crab'];
// 	biome3OpponentsArray = ['shark', 'humpback whale'];
// }

speciesMap.set('orca', {
	name: 'orca',
	diet: 'carnivore',
	habitat: 'water',
	biome1OpponentArray: ['salmon', 'tuna', 'squid'],
	biome2OpponentArray: ['seal', 'crab'],
	biome3OpponentArray: ['shark', 'humpback whale'],
});

// nameArray[18] = 'maned wolf';
// dietArray[18] = 'omnivore';
// habitatArray[18] = 'warm';
// if (profileData && profileData.species == nameArray[18]) {
// 	biome1OpponentsArray = ['caracal', 'coyote'];
// 	biome2OpponentsArray = ['leopard'];
// 	biome3OpponentsArray = ['tiger', 'lion'];
// }

speciesMap.set('maned wolf', {
	name: 'maned wolf',
	diet: 'omnivore',
	habitat: 'warm',
	biome1OpponentArray: ['caracal', 'coyote'],
	biome2OpponentArray: ['leopard', 'goat'],
	biome3OpponentArray: ['tiger', 'lion'],
});

// nameArray[19] = 'dog';
// dietArray[19] = 'omnivore';
// habitatArray[19] = 'cold';
// if (profileData && profileData.species == nameArray[19]) {
// 	biome1OpponentsArray = ['rabbit', 'squirrel', 'deer'];
// 	biome2OpponentsArray = ['wolf', 'fox'];
// 	biome3OpponentsArray = ['cat', 'bear'];
// }

speciesMap.set('dog', {
	name: 'dog',
	diet: 'omnivore',
	habitat: 'cold',
	biome1OpponentArray: ['rabbit', 'squirrel', 'deer'],
	biome2OpponentArray: ['wolf', 'fox'],
	biome3OpponentArray: ['cat', 'bear'],
});

// nameArray[20] = 'owl';
// dietArray[20] = 'carnivore';
// habitatArray[20] = 'cold';
// if (profileData && profileData.species == nameArray[20]) {
// 	biome1OpponentsArray = ['rabbit', 'squirrel'];
// 	biome2OpponentsArray = ['cat', 'fox'];
// 	biome3OpponentsArray = ['wolf', 'bear'];
// }

speciesMap.set('owl', {
	name: 'owl',
	diet: 'carnivore',
	habitat: 'cold',
	biome1OpponentArray: ['rabbit', 'squirrel'],
	biome2OpponentArray: ['cat', 'fox'],
	biome3OpponentArray: ['wolf', 'bear'],
});

// nameArray[21] = 'deer';
// dietArray[21] = 'herbivore';
// habitatArray[21] = 'cold';
// if (profileData && profileData.species == nameArray[21]) {
// 	biome1OpponentsArray = ['rabbit', 'squirrel'];
// 	biome2OpponentsArray = ['fox', 'owl'];
// 	biome3OpponentsArray = ['wolf', 'bear', 'dog'];
// }

speciesMap.set('deer', {
	name: 'deer',
	diet: 'herbivore',
	habitat: 'cold',
	biome1OpponentArray: ['rabbit', 'squirrel'],
	biome2OpponentArray: ['fox', 'owl'],
	biome3OpponentArray: ['wolf', 'bear', 'dog'],
});

// nameArray[22] = 'penguin';
// dietArray[22] = 'carnivore';
// habitatArray[22] = 'cold';
// if (profileData && profileData.species == nameArray[22]) {
// 	biome1OpponentsArray = ['salmon', 'tuna', 'squid', 'crab'];
// 	biome2OpponentsArray = ['dog', 'cat', 'fox'];
// 	biome3OpponentsArray = ['shark', 'seal', 'orca'];
// }

speciesMap.set('penguin', {
	name: 'penguin',
	diet: 'carnivore',
	habitat: 'cold',
	biome1OpponentArray: ['salmon', 'tuna', 'squid', 'crab'],
	biome2OpponentArray: ['dog', 'cat', 'fox'],
	biome3OpponentArray: ['shark', 'seal', 'orca'],
});

// nameArray[23] = 'gaboon viper';
// dietArray[23] = 'carnivore';
// habitatArray[23] = 'warm';
// if (profileData && profileData.species == nameArray[23]) {
// 	biome1OpponentsArray = ['cat', 'rabbit', 'owl'];
// 	biome2OpponentsArray = ['leopard', 'caracal'];
// 	biome3OpponentsArray = ['lion', 'tiger'];
// }

speciesMap.set('gaboon viper', {
	name: 'gaboon viper',
	diet: 'carnivore',
	habitat: 'warm',
	biome1OpponentArray: ['cat', 'rabbit', 'owl'],
	biome2OpponentArray: ['leopard', 'caracal'],
	biome3OpponentArray: ['lion', 'tiger'],
});

// nameArray[24] = 'hoatzin';
// dietArray[24] = 'herbivore';
// habitatArray[24] = 'warm';
// if (profileData && profileData.species == nameArray[24]) {
// 	biome1OpponentsArray = ['squirrel', 'rabbit'];
// 	biome2OpponentsArray = ['cat', 'weasel'];
// 	biome3OpponentsArray = ['eagle', 'hawk', 'cassowary'];
// }

speciesMap.set('hoatzin', {
	name: 'hoatzin',
	diet: 'herbivore',
	habitat: 'warm',
	biome1OpponentArray: ['squirrel', 'rabbit', 'goat'],
	biome2OpponentArray: ['cat', 'weasel'],
	biome3OpponentArray: ['eagle', 'hawk', 'cassowary'],
});

// nameArray[25] = 'weasel';
// dietArray[25] = 'carnivore';
// habitatArray[25] = 'warm';
// if (profileData && profileData.species == nameArray[25]) {
// 	biome1OpponentsArray = ['squirrel', 'rabbit'];
// 	biome2OpponentsArray = ['cat', 'fox'];
// 	biome3OpponentsArray = ['owl', 'gaboon viper'];
// }

speciesMap.set('weasel', {
	name: 'weasel',
	diet: 'carnivore',
	habitat: 'warm',
	biome1OpponentArray: ['squirrel', 'rabbit'],
	biome2OpponentArray: ['cat', 'fox'],
	biome3OpponentArray: ['owl', 'gaboon viper'],
});

// nameArray[26] = 'hawk';
// dietArray[26] = 'carnivore';
// habitatArray[26] = 'warm';
// if (profileData && profileData.species == nameArray[26]) {
// 	biome1OpponentsArray = ['squirrel', 'rabbit'];
// 	biome2OpponentsArray = ['owl', 'raccoon'];
// 	biome3OpponentsArray = ['eagle', 'gaboon viper', 'cassowary'];
// }

speciesMap.set('hawk', {
	name: 'hawk',
	diet: 'carnivore',
	habitat: 'warm',
	biome1OpponentArray: ['squirrel', 'rabbit', 'goat'],
	biome2OpponentArray: ['owl', 'raccoon'],
	biome3OpponentArray: ['eagle', 'gaboon viper', 'cassowary'],
});

// nameArray[27] = 'eagle';
// dietArray[27] = 'carnivore';
// habitatArray[27] = 'warm';
// if (profileData && profileData.species == nameArray[27]) {
// 	biome1OpponentsArray = ['squirrel', 'rabbit'];
// 	biome2OpponentsArray = ['bear', 'raccoon'];
// 	biome3OpponentsArray = ['hawk', 'gaboon viper', 'cassowary'];
// }

speciesMap.set('eagle', {
	name: 'eagle',
	diet: 'carnivore',
	habitat: 'warm',
	biome1OpponentArray: ['squirrel', 'rabbit', 'goat'],
	biome2OpponentArray: ['bear', 'raccoon'],
	biome3OpponentArray: ['hawk', 'gaboon viper', 'cassowary'],
});

// nameArray[28] = 'raccoon';
// dietArray[28] = 'omnivore';
// habitatArray[28] = 'warm';
// if (profileData && profileData.species == nameArray[28]) {
// 	biome1OpponentsArray = ['salmon', 'rabbit'];
// 	biome2OpponentsArray = ['owl', 'fox', 'cat'];
// 	biome3OpponentsArray = ['coyote', 'wolf'];
// }

speciesMap.set('raccoon', {
	name: 'raccoon',
	diet: 'omnivore',
	habitat: 'cold',
	biome1OpponentArray: ['salmon', 'rabbit'],
	biome2OpponentArray: ['owl', 'fox', 'cat'],
	biome3OpponentArray: ['coyote', 'wolf'],
});

// nameArray[29] = 'horse';
// dietArray[29] = 'herbivore';
// habitatArray[29] = 'cold';
// if (profileData && profileData.species == nameArray[29]) {
// 	biome1OpponentsArray = ['cat', 'fox'];
// 	biome2OpponentsArray = ['deer', 'dog'];
// 	biome3OpponentsArray = ['bear', 'wolf', 'elk'];
// }

speciesMap.set('horse', {
	name: 'horse',
	diet: 'herbivore',
	habitat: 'cold',
	biome1OpponentArray: ['cat', 'fox'],
	biome2OpponentArray: ['deer', 'dog'],
	biome3OpponentArray: ['bear', 'wolf', 'elk'],
});

// nameArray[30] = 'elk';
// dietArray[30] = 'herbivore';
// habitatArray[30] = 'cold';
// if (profileData && profileData.species == nameArray[30]) {
// 	biome1OpponentsArray = ['cat', 'fox'];
// 	biome2OpponentsArray = ['deer', 'dog'];
// 	biome3OpponentsArray = ['bear', 'wolf', 'horse'];
// }

speciesMap.set('elk', {
	name: 'elk',
	diet: 'herbivore',
	habitat: 'cold',
	biome1OpponentArray: ['cat', 'fox'],
	biome2OpponentArray: ['deer', 'dog'],
	biome3OpponentArray: ['bear', 'wolf', 'horse'],
});

// nameArray[31] = 'cassowary';
// dietArray[31] = 'omnivore';
// habitatArray[31] = 'warm';
// if (profileData && profileData.species == nameArray[31]) {
// 	biome1OpponentsArray = ['maned wolf', 'dog'];
// 	biome2OpponentsArray = ['hoatzin', 'gaboon viper'];
// 	biome3OpponentsArray = ['hawk', 'eagle'];
// }

speciesMap.set('cassowary', {
	name: 'cassowary',
	diet: 'omnivore',
	habitat: 'warm',
	biome1OpponentArray: ['maned wolf', 'dog'],
	biome2OpponentArray: ['hoatzin', 'gaboon viper'],
	biome3OpponentArray: ['hawk', 'eagle'],
});

// nameArray[32] = 'humpback whale';
// dietArray[32] = 'omnivore';
// habitatArray[32] = 'water';
// if (profileData && profileData.species == nameArray[32]) {
// 	biome1OpponentsArray = ['salmon', 'tuna', 'squid'];
// 	biome2OpponentsArray = ['seal', 'crab'];
// 	biome3OpponentsArray = ['orca', 'shark'];
// }

speciesMap.set('humpback whale', {
	name: 'humpback whale',
	diet: 'omnivore',
	habitat: 'water',
	biome1OpponentArray: ['salmon', 'tuna', 'squid'],
	biome2OpponentArray: ['seal', 'crab'],
	biome3OpponentArray: ['orca', 'shark'],
});

speciesMap.set('goat', {
	name: 'goat',
	diet: 'herbivore',
	habitat: 'cold',
	biome1OpponentArray: ['wolf', 'bear', 'maned wolf'],
	biome2OpponentArray: ['fox', 'eagle'],
	biome3OpponentArray: ['dog', 'coyote'],
});


module.exports = {

	// commonPlantNamesArray: commonPlantNamesArray,
	// commonPlantEdibalityArray: commonPlantEdibalityArray,
	// commonPlantHealsWoundsArray: commonPlantHealsWoundsArray,
	// commonPlantHealsInfectionsArray: commonPlantHealsInfectionsArray,
	// commonPlantHealsColdsArray: commonPlantHealsColdsArray,
	// commonPlantHealsPoisonArray: commonPlantHealsPoisonArray,
	// commonPlantHealsSprainsArray: commonPlantHealsSprainsArray,
	// commonPlantGivesEnergyArray: commonPlantGivesEnergyArray,
	// commonPlantDescriptionsArray: commonPlantDescriptionsArray,
	commonPlantMap: commonPlantMap,

	// uncommonPlantNamesArray: uncommonPlantNamesArray,
	// uncommonPlantEdibalityArray: uncommonPlantEdibalityArray,
	// uncommonPlantHealsWoundsArray: uncommonPlantHealsWoundsArray,
	// uncommonPlantHealsInfectionsArray: uncommonPlantHealsInfectionsArray,
	// uncommonPlantHealsColdsArray: uncommonPlantHealsColdsArray,
	// uncommonPlantHealsPoisonArray: uncommonPlantHealsPoisonArray,
	// uncommonPlantHealsSprainsArray: uncommonPlantHealsSprainsArray,
	// uncommonPlantGivesEnergyArray: uncommonPlantGivesEnergyArray,
	// uncommonPlantDescriptionsArray: uncommonPlantDescriptionsArray,
	uncommonPlantMap: uncommonPlantMap,

	// rarePlantNamesArray: rarePlantNamesArray,
	// rarePlantEdibalityArray: rarePlantEdibalityArray,
	// rarePlantHealsWoundsArray: rarePlantHealsWoundsArray,
	// rarePlantHealsInfectionsArray: rarePlantHealsInfectionsArray,
	// rarePlantHealsColdsArray: rarePlantHealsColdsArray,
	// rarePlantHealsPoisonArray: rarePlantHealsPoisonArray,
	// rarePlantHealsSprainsArray: rarePlantHealsSprainsArray,
	// rarePlantGivesEnergyArray: rarePlantGivesEnergyArray,
	// rarePlantDescriptionsArray: rarePlantDescriptionsArray,
	rarePlantMap: rarePlantMap,

	// return {
	// nameArray: nameArray,
	// dietArray: dietArray,
	// habitatArray: habitatArray,
	// biome1OpponentsArray: biome1OpponentsArray,
	// biome2OpponentsArray: biome2OpponentsArray,
	// biome3OpponentsArray: biome3OpponentsArray,
	// };

	speciesMap: speciesMap,

};
