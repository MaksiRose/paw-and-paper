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


const speciesMap = new Map();

speciesMap.set('wolf', {
	name: 'wolf',
	diet: 'carnivore',
	habitat: 'cold',
	biome1OpponentArray: ['rabbit', 'squirrel', 'deer'],
	biome2OpponentArray: ['fox', 'dog', 'goat'],
	biome3OpponentArray: ['bear', 'horse', 'elk'],
});

speciesMap.set('cat', {
	name: 'cat',
	diet: 'carnivore',
	habitat: 'cold',
	biome1OpponentArray: ['rabbit', 'squirrel', 'owl'],
	biome2OpponentArray: ['fox', 'bear'],
	biome3OpponentArray: ['wolf', 'dog'],
});

speciesMap.set('fox', {
	name: 'fox',
	diet: 'omnivore',
	habitat: 'cold',
	biome1OpponentArray: ['rabbit', 'squirrel', 'owl'],
	biome2OpponentArray: ['cat', 'dog', 'deer'],
	biome3OpponentArray: ['wolf', 'bear'],
});

speciesMap.set('leopard', {
	name: 'leopard',
	diet: 'carnivore',
	habitat: 'warm',
	biome1OpponentArray: ['coyote', 'maned wolf'],
	biome2OpponentArray: ['caracal'],
	biome3OpponentArray: ['tiger', 'lion'],
});

speciesMap.set('tiger', {
	name: 'tiger',
	diet: 'carnivore',
	habitat: 'warm',
	biome1OpponentArray: ['coyote', 'maned wolf'],
	biome2OpponentArray: ['leopard', 'caracal'],
	biome3OpponentArray: ['lion'],
});

speciesMap.set('shark', {
	name: 'shark',
	diet: 'carnivore',
	habitat: 'water',
	biome1OpponentArray: ['salmon', 'tuna', 'squid'],
	biome2OpponentArray: ['seal', 'crab'],
	biome3OpponentArray: ['orca', 'humpback whale'],
});

speciesMap.set('caracal', {
	name: 'caracal',
	diet: 'carnivore',
	habitat: 'warm',
	biome1OpponentArray: ['coyote', 'maned wolf'],
	biome2OpponentArray: ['leopard', 'tiger'],
	biome3OpponentArray: ['lion'],
});

speciesMap.set('bear', {
	name: 'bear',
	diet: 'omnivore',
	habitat: 'cold',
	biome1OpponentArray: ['rabbit', 'squirrel', 'salmon', 'tuna'],
	biome2OpponentArray: ['cat', 'fox', 'dog'],
	biome3OpponentArray: ['wolf', 'horse', 'elk'],
});

speciesMap.set('coyote', {
	name: 'coyote',
	diet: 'omnivore',
	habitat: 'warm',
	biome1OpponentArray: ['caracal', 'maned wolf'],
	biome2OpponentArray: ['leopard', 'goat'],
	biome3OpponentArray: ['tiger', 'lion'],
});

speciesMap.set('rabbit', {
	name: 'rabbit',
	diet: 'herbivore',
	habitat: 'cold',
	biome1OpponentArray: ['squirrel', 'owl'],
	biome2OpponentArray: ['dog', 'deer'],
	biome3OpponentArray: ['wolf', 'cat', 'bear'],
});

speciesMap.set('squirrel', {
	name: 'squirrel',
	diet: 'omnivore',
	habitat: 'cold',
	biome1OpponentArray: ['rabbit', 'owl'],
	biome2OpponentArray: ['dog', 'deer'],
	biome3OpponentArray: ['wolf', 'cat', 'bear'],
});

speciesMap.set('lion', {
	name: 'lion',
	diet: 'carnivore',
	habitat: 'warm',
	biome1OpponentArray: ['coyote', 'maned wolf'],
	biome2OpponentArray: ['leopard', 'caracal'],
	biome3OpponentArray: ['tiger'],
});

speciesMap.set('seal', {
	name: 'seal',
	diet: 'carnivore',
	habitat: 'water',
	biome1OpponentArray: ['salmon', 'tuna', 'squid'],
	biome2OpponentArray: ['bear', 'crab'],
	biome3OpponentArray: ['shark', 'orca'],
});

speciesMap.set('salmon', {
	name: 'salmon',
	diet: 'carnivore',
	habitat: 'water',
	biome1OpponentArray: ['squid'],
	biome2OpponentArray: ['crab'],
	biome3OpponentArray: ['bear', 'seal', 'owl'],
});

speciesMap.set('tuna', {
	name: 'tuna',
	diet: 'carnivore',
	habitat: 'water',
	biome1OpponentArray: ['salmon', 'squid'],
	biome2OpponentArray: ['crab'],
	biome3OpponentArray: ['bear', 'seal', 'owl'],
});

speciesMap.set('squid', {
	name: 'squid',
	diet: 'carnivore',
	habitat: 'water',
	biome1OpponentArray: ['crab'],
	biome2OpponentArray: ['tuna', 'salmon'],
	biome3OpponentArray: ['shark', 'seal', 'owl'],
});

speciesMap.set('crab', {
	name: 'crab',
	diet: 'omnivore',
	habitat: 'water',
	biome1OpponentArray: ['squid'],
	biome2OpponentArray: ['tuna', 'salmon'],
	biome3OpponentArray: ['bear', 'seal', 'owl'],
});

speciesMap.set('orca', {
	name: 'orca',
	diet: 'carnivore',
	habitat: 'water',
	biome1OpponentArray: ['salmon', 'tuna', 'squid'],
	biome2OpponentArray: ['seal', 'crab'],
	biome3OpponentArray: ['shark', 'humpback whale'],
});

speciesMap.set('maned wolf', {
	name: 'maned wolf',
	diet: 'omnivore',
	habitat: 'warm',
	biome1OpponentArray: ['caracal', 'coyote'],
	biome2OpponentArray: ['leopard', 'goat'],
	biome3OpponentArray: ['tiger', 'lion'],
});

speciesMap.set('dog', {
	name: 'dog',
	diet: 'omnivore',
	habitat: 'cold',
	biome1OpponentArray: ['rabbit', 'squirrel', 'deer'],
	biome2OpponentArray: ['wolf', 'fox'],
	biome3OpponentArray: ['cat', 'bear'],
});

speciesMap.set('owl', {
	name: 'owl',
	diet: 'carnivore',
	habitat: 'cold',
	biome1OpponentArray: ['rabbit', 'squirrel'],
	biome2OpponentArray: ['cat', 'fox'],
	biome3OpponentArray: ['wolf', 'bear'],
});

speciesMap.set('deer', {
	name: 'deer',
	diet: 'herbivore',
	habitat: 'cold',
	biome1OpponentArray: ['rabbit', 'squirrel'],
	biome2OpponentArray: ['fox', 'owl'],
	biome3OpponentArray: ['wolf', 'bear', 'dog'],
});

speciesMap.set('penguin', {
	name: 'penguin',
	diet: 'carnivore',
	habitat: 'cold',
	biome1OpponentArray: ['salmon', 'tuna', 'squid', 'crab'],
	biome2OpponentArray: ['dog', 'cat', 'fox'],
	biome3OpponentArray: ['shark', 'seal', 'orca'],
});

speciesMap.set('gaboon viper', {
	name: 'gaboon viper',
	diet: 'carnivore',
	habitat: 'warm',
	biome1OpponentArray: ['cat', 'rabbit', 'owl'],
	biome2OpponentArray: ['leopard', 'caracal'],
	biome3OpponentArray: ['lion', 'tiger'],
});

speciesMap.set('hoatzin', {
	name: 'hoatzin',
	diet: 'herbivore',
	habitat: 'warm',
	biome1OpponentArray: ['squirrel', 'rabbit', 'goat'],
	biome2OpponentArray: ['cat', 'weasel'],
	biome3OpponentArray: ['eagle', 'hawk', 'cassowary'],
});

speciesMap.set('weasel', {
	name: 'weasel',
	diet: 'carnivore',
	habitat: 'warm',
	biome1OpponentArray: ['squirrel', 'rabbit'],
	biome2OpponentArray: ['cat', 'fox'],
	biome3OpponentArray: ['owl', 'gaboon viper'],
});

speciesMap.set('hawk', {
	name: 'hawk',
	diet: 'carnivore',
	habitat: 'warm',
	biome1OpponentArray: ['squirrel', 'rabbit', 'goat'],
	biome2OpponentArray: ['owl', 'raccoon'],
	biome3OpponentArray: ['eagle', 'gaboon viper', 'cassowary'],
});

speciesMap.set('eagle', {
	name: 'eagle',
	diet: 'carnivore',
	habitat: 'warm',
	biome1OpponentArray: ['squirrel', 'rabbit', 'goat'],
	biome2OpponentArray: ['bear', 'raccoon'],
	biome3OpponentArray: ['hawk', 'gaboon viper', 'cassowary'],
});

speciesMap.set('raccoon', {
	name: 'raccoon',
	diet: 'omnivore',
	habitat: 'cold',
	biome1OpponentArray: ['salmon', 'rabbit'],
	biome2OpponentArray: ['owl', 'fox', 'cat'],
	biome3OpponentArray: ['coyote', 'wolf'],
});

speciesMap.set('horse', {
	name: 'horse',
	diet: 'herbivore',
	habitat: 'cold',
	biome1OpponentArray: ['cat', 'fox'],
	biome2OpponentArray: ['deer', 'dog'],
	biome3OpponentArray: ['bear', 'wolf', 'elk'],
});

speciesMap.set('elk', {
	name: 'elk',
	diet: 'herbivore',
	habitat: 'cold',
	biome1OpponentArray: ['cat', 'fox'],
	biome2OpponentArray: ['deer', 'dog'],
	biome3OpponentArray: ['bear', 'wolf', 'horse'],
});


speciesMap.set('cassowary', {
	name: 'cassowary',
	diet: 'omnivore',
	habitat: 'warm',
	biome1OpponentArray: ['maned wolf', 'dog'],
	biome2OpponentArray: ['hoatzin', 'gaboon viper'],
	biome3OpponentArray: ['hawk', 'eagle'],
});

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
	
	commonPlantMap: commonPlantMap,
	uncommonPlantMap: uncommonPlantMap,
	rarePlantMap: rarePlantMap,
	speciesMap: speciesMap,

};
speciesMap.set('kinkajou', {
	name: 'kinkajou',
	diet: 'omnivore',
	habitat: 'warm',
	biome1OpponentArray: ['crab', 'hoatzin', 'salmon'],
	biome2OpponentArray: ['hawk', 'owl'],
	biome3OpponentArray: ['elk', 'manned wolf'],
});
