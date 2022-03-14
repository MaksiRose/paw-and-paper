const commonPlantsMap = new Map();

commonPlantsMap.set('raspberry', {
	name: 'raspberry',
	description: 'A tasty berry! Good for the quick hunger.',
	edibality: 'e',
	healsWounds: false,
	healsInfections: false,
	healsColds: false,
	healsSprains: false,
	healsPoison: false,
	givesEnergy: false,
});

commonPlantsMap.set('garlic', {
	name: 'garlic',
	description: 'A nourishing plant in the onion genus.',
	edibality: 'e',
	healsWounds: false,
	healsInfections: false,
	healsColds: false,
	healsSprains: false,
	healsPoison: false,
	givesEnergy: false,
});

commonPlantsMap.set('herb Robert', {
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

commonPlantsMap.set('field scabious', {
	name: 'field scabious',
	description: 'This pretty flower is used to fight colds.',
	edibality: 'i',
	healsWounds: false,
	healsInfections: false,
	healsColds: true,
	healsSprains: false,
	healsPoison: false,
	givesEnergy: false,
});

commonPlantsMap.set('henna', {
	name: 'henna',
	description: 'A flowering plant often used as dye, but also used against infections and inflammations.',
	edibality: 'i',
	healsWounds: false,
	healsInfections: true,
	healsColds: false,
	healsSprains: false,
	healsPoison: false,
	givesEnergy: false,
});

commonPlantsMap.set('elderberry', {
	name: 'elderberry',
	description: 'This berry is poisonous when eaten uncooked, but it helps against colds when used as a medicine.',
	edibality: 't',
	healsWounds: false,
	healsInfections: false,
	healsColds: true,
	healsSprains: false,
	healsPoison: false,
	givesEnergy: false,
});

commonPlantsMap.set('comfrey', {
	name: 'comfrey',
	description: 'Comfrey is a flowering plant that is toxic when eaten, but heals sprains and swellings when applied directly.',
	edibality: 't',
	healsWounds: false,
	healsInfections: false,
	healsColds: false,
	healsSprains: true,
	healsPoison: false,
	givesEnergy: false,
});

commonPlantsMap.set('marigold', {
	name: 'marigold',
	description: 'This flowering plant is great when used to heal infection.',
	edibality: 'i',
	healsWounds: false,
	healsInfections: true,
	healsColds: false,
	healsSprains: false,
	healsPoison: false,
	givesEnergy: false,
});

commonPlantsMap.set('common hollyhock', {
	name: 'common hollyhock',
	description: 'A flower frequently used to fight wounds and bruises.',
	edibality: 'i',
	healsWounds: true,
	healsInfections: false,
	healsColds: false,
	healsSprains: false,
	healsPoison: false,
	givesEnergy: false,
});

commonPlantsMap.set('arnica', {
	name: 'neem',
	description: 'This plant of the sunflower family contains a toxin and shouldn\'t be eaten, though it helps reduce pain from sprains.',
	edibality: 't',
	healsWounds: false,
	healsInfections: false,
	healsColds: false,
	healsSprains: true,
	healsPoison: false,
	givesEnergy: false,
});

commonPlantsMap.set('clover', {
	name: 'clover',
	description: 'Several plants of the genus Trifolium. A common source of nourishment.',
	edibality: 'e',
	healsWounds: false,
	healsInfections: false,
	healsColds: false,
	healsSprains: false,
	healsPoison: false,
	givesEnergy: false,
});

commonPlantsMap.set('passion fruit', {
	name: 'passion fruit',
	description: 'Vine species of the passion flower. Very nutritious.',
	edibality: 'e',
	healsWounds: false,
	healsInfections: false,
	healsColds: false,
	healsSprains: false,
	healsPoison: false,
	givesEnergy: false,
});

commonPlantsMap.set('bergamot orange', {
	name: 'bergamot orange',
	description: 'A citrus fruit the size of an orange. Less sour than lemon, but more bitter than grapefruit.',
	edibality: 'e',
	healsWounds: false,
	healsInfections: false,
	healsColds: false,
	healsSprains: false,
	healsPoison: false,
	givesEnergy: false,
});

commonPlantsMap.set('cicely', {
	name: 'cicely',
	description: 'This plant grows 6ft 6in (2m) high. Both the leaves and the roots are edible.',
	edibality: 'e',
	healsWounds: false,
	healsInfections: false,
	healsColds: false,
	healsSprains: false,
	healsPoison: false,
	givesEnergy: false,
});

commonPlantsMap.set('acorn', {
	name: 'acorn',
	description: 'This nut is highly nutritious and therefore serves as an excellent source of food.',
	edibality: 'e',
	healsWounds: false,
	healsInfections: false,
	healsColds: false,
	healsSprains: false,
	healsPoison: false,
	givesEnergy: false,
});

commonPlantsMap.set('rhodiola', {
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


const uncommonPlantsMap = new Map();

uncommonPlantsMap.set('solomon\'s seal', {
	name: 'solomon\'s seal',
	description: 'This flowering plant is a great source of food, but also excellent for healing colds as well as wounds!',
	edibality: 'e',
	healsWounds: true,
	healsInfections: false,
	healsColds: true,
	healsSprains: false,
	healsPoison: false,
	givesEnergy: false,
});

uncommonPlantsMap.set('gotu kola', {
	name: 'gotu kola',
	description: 'A vegetable often used to treat infections, as well as being very energizing!',
	edibality: 'e',
	healsWounds: false,
	healsInfections: true,
	healsColds: false,
	healsSprains: false,
	healsPoison: false,
	givesEnergy: true,
});

uncommonPlantsMap.set('great mullein', {
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

uncommonPlantsMap.set('purple coneflower', {
	name: 'purple coneflower',
	description: 'This flower is not only part of the sunflower family, but also a treatment against colds, infections, and hunger!',
	edibality: 'e',
	healsWounds: false,
	healsInfections: true,
	healsColds: true,
	healsSprains: false,
	healsPoison: false,
	givesEnergy: false,
});

uncommonPlantsMap.set('field horsetail', {
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

uncommonPlantsMap.set('bay laurel', {
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

uncommonPlantsMap.set('chick weed', {
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

uncommonPlantsMap.set('yerba mate', {
	name: 'yerba mate',
	description: 'This plants leaves are useful for healing infections, but also energizing due to it containing caffeine.',
	edibality: 'e',
	healsWounds: false,
	healsInfections: true,
	healsColds: false,
	healsSprains: false,
	healsPoison: false,
	givesEnergy: true,
});


const rarePlantsMap = new Map();

rarePlantsMap.set('ribwort plantain', {
	name: 'ribwort plantain',
	description: 'A weed for treating wounds, colds and poison! Highly nutritious.',
	edibality: 'e',
	healsWounds: true,
	healsInfections: false,
	healsColds: false,
	healsSprains: true,
	healsPoison: true,
	givesEnergy: false,
});

rarePlantsMap.set('charcoal-tree leaves', {
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

rarePlantsMap.set('marsh mallow', {
	name: 'marsh mallow',
	description: 'This sweet tasting, energizing plant is very effective against infections, sprains!',
	edibality: 'e',
	healsWounds: false,
	healsInfections: true,
	healsColds: false,
	healsSprains: true,
	healsPoison: false,
	givesEnergy: true,
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
	biome1OpponentArray: ['rabbit', 'bee', 'salmon', 'tuna'],
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
	biome1OpponentArray: ['rabbit', 'squirrel', 'moth', 'beetle'],
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
	biome1OpponentArray: ['squirrel', 'rabbit', 'cricket', 'praying mantis'],
	biome2OpponentArray: ['cat', 'fox'],
	biome3OpponentArray: ['owl', 'gaboon viper'],
});

speciesMap.set('hawk', {
	name: 'hawk',
	diet: 'carnivore',
	habitat: 'warm',
	biome1OpponentArray: ['squirrel', 'rabbit', 'goat'],
	biome2OpponentArray: ['owl', 'raccoon', 'kinkajou'],
	biome3OpponentArray: ['eagle', 'gaboon viper', 'cassowary'],
});

speciesMap.set('eagle', {
	name: 'eagle',
	diet: 'carnivore',
	habitat: 'warm',
	biome1OpponentArray: ['squirrel', 'rabbit', 'goat'],
	biome2OpponentArray: ['bear', 'raccoon', 'kinkajou'],
	biome3OpponentArray: ['hawk', 'gaboon viper', 'cassowary'],
});

speciesMap.set('raccoon', {
	name: 'raccoon',
	diet: 'omnivore',
	habitat: 'cold',
	biome1OpponentArray: ['salmon', 'rabbit', 'praying mantis'],
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

speciesMap.set('kinkajou', {
	name: 'kinkajou',
	diet: 'omnivore',
	habitat: 'warm',
	biome1OpponentArray: ['crab', 'hoatzin', 'salmon'],
	biome2OpponentArray: ['hawk', 'eagle'],
	biome3OpponentArray: ['gaboon viper', 'lion'],
});

speciesMap.set('praying mantis', {
	name: 'praying mantis',
	diet: 'carnivore',
	habitat: 'cold',
	biome1OpponentArray: ['cricket', 'beetle'],
	biome2OpponentArray: ['moth', 'bee'],
	biome3OpponentArray: ['weasel', 'raccoon'],
});

speciesMap.set('cricket', {
	name: 'cricket',
	diet: 'omnivore',
	habitat: 'cold',
	biome1OpponentArray: ['moth', 'beetle'],
	biome2OpponentArray: ['praying mantis', 'bee'],
	biome3OpponentArray: ['weasel', 'owl'],
});

speciesMap.set('beetle', {
	name: 'beetle',
	diet: 'omnivore',
	habitat: 'cold',
	biome1OpponentArray: ['cricket', 'moth'],
	biome2OpponentArray: ['praying mantis', 'bee'],
	biome3OpponentArray: ['weasel', 'owl'],
});

speciesMap.set('moth', {
	name: 'moth',
	diet: 'omnivore',
	habitat: 'cold',
	biome1OpponentArray: ['moth', 'praying mantis'],
	biome2OpponentArray: ['cricket', 'beetle'],
	biome3OpponentArray: ['bee', 'owl'],
});

speciesMap.set('bee', {
	name: 'bee',
	diet: 'herbivore',
	habitat: 'warm',
	biome1OpponentArray: ['cricket', 'beetle'],
	biome2OpponentArray: ['moth', 'praying mantis'],
	biome3OpponentArray: ['bear', 'owl'],
});

speciesMap.set('cougar', {
	name: 'cougar',
	diet: 'carnivore',
	habitat: 'cold',
	biome1OpponentArray: ['deer', 'goal'],
	biome2OpponentArray: ['elk', 'coyote'],
	biome3OpponentArray: ['bear', 'wolf'],
});

speciesMap.set('frog', {
	name: 'frog',
	diet: 'carnivore',
	habitat: 'cold',
	biome1OpponentArray: ['beetle', 'cricket', 'praying mantis'],
	biome2OpponentArray: ['raccoon', 'fox'],
	biome3OpponentArray: ['owl', 'crow'],
});


module.exports = {

	commonPlantsMap: commonPlantsMap,
	uncommonPlantsMap: uncommonPlantsMap,
	rarePlantsMap: rarePlantsMap,
	speciesMap: speciesMap,

};
