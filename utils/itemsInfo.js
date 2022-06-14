// @ts-check

/** @type {Map<string, import('../typedef').PlantMapObject>} */
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
	increasesMaxCondition: false,
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
	increasesMaxCondition: false,
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
	increasesMaxCondition: false,
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
	increasesMaxCondition: false,
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
	increasesMaxCondition: false,
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
	increasesMaxCondition: false,
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
	increasesMaxCondition: false,
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
	increasesMaxCondition: false,
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
	increasesMaxCondition: false,
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
	increasesMaxCondition: false,
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
	increasesMaxCondition: false,
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
	increasesMaxCondition: false,
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
	increasesMaxCondition: false,
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
	increasesMaxCondition: false,
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
	increasesMaxCondition: false,
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
	increasesMaxCondition: false,
});


/** @type {Map<string, import('../typedef').PlantMapObject>} */
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
	increasesMaxCondition: false,
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
	increasesMaxCondition: false,
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
	increasesMaxCondition: false,
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
	increasesMaxCondition: false,
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
	increasesMaxCondition: false,
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
	increasesMaxCondition: false,
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
	increasesMaxCondition: false,
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
	increasesMaxCondition: false,
});


/** @type {Map<string, import('../typedef').PlantMapObject>} */
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
	increasesMaxCondition: false,
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
	increasesMaxCondition: false,
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
	increasesMaxCondition: false,
});


/** @type {Map<string, import('../typedef').PlantMapObject>} */
const specialPlantsMap = new Map();

specialPlantsMap.set('black-eyed Susan', {
	name: 'black-eyed Susan',
	description: 'This flower from the sunflower family is thought to give a temporary boost to one\'s maximum health, energy, hunger or thirst.',
	edibality: 'e',
	healsWounds: false,
	healsInfections: false,
	healsColds: false,
	healsSprains: false,
	healsPoison: false,
	givesEnergy: false,
	increasesMaxCondition: true,
});


/** @type {Map<string, import('../typedef').MaterialsMapObject>} */
const materialsMap = new Map();

materialsMap.set('stick', {
	name: 'stick',
	description: 'These are not the sturdiest material out there, but they can help holding together constructions.',
	reinforcesStructure: true,
	improvesBedding: false,
	thickensWalls: false,
	removesOverhang: false,
});

materialsMap.set('pine cone', {
	name: 'pine cone',
	description: 'The seed-bearing fruit of the pine tree. The wooden exterior and shape make it great for reinforcing structures.',
	reinforcesStructure: true,
	improvesBedding: false,
	thickensWalls: false,
	removesOverhang: false,
});

materialsMap.set('root', {
	name: 'root',
	description: 'Remainders of dead trees. With their toughness as support, they can be like a skeleton or frame of a structure.',
	reinforcesStructure: true,
	improvesBedding: false,
	thickensWalls: false,
	removesOverhang: false,
});

materialsMap.set('moss', {
	name: 'moss',
	description: 'A soft and easy to maintain plant that makes for a great floor component.',
	reinforcesStructure: false,
	improvesBedding: true,
	thickensWalls: false,
	removesOverhang: false,
});

materialsMap.set('leaf', {
	name: 'leaf',
	description: 'Foilage is not only vital to most plants, but also has a great texture and acts as a dampening effect when walked over.',
	reinforcesStructure: false,
	improvesBedding: true,
	thickensWalls: false,
	removesOverhang: false,
});

materialsMap.set('algae', {
	name: 'algae',
	description: 'Seaweed is not only pretty, but also spongy and comfortable, making it perfect as ground material.',
	reinforcesStructure: false,
	improvesBedding: false,
	thickensWalls: true,
	removesOverhang: false,
});

materialsMap.set('clay', {
	name: 'clay',
	description: 'This type of dirt is deformable when wet, but tough and brittle when dry, making it a great filler-material for walls.',
	reinforcesStructure: false,
	improvesBedding: false,
	thickensWalls: true,
	removesOverhang: false,
});

materialsMap.set('vine', {
	name: 'vine',
	description: 'The long-growing plant will spread and twist around walls. They are not robust, but their leaves will densen whatever they are growing on.',
	reinforcesStructure: false,
	improvesBedding: false,
	thickensWalls: true,
	removesOverhang: false,
});

materialsMap.set('soil', {
	name: 'soil',
	description: 'This common material is easy to deform, but still strong when pressed together, making it perfect for thickening walls and ceilings.',
	reinforcesStructure: false,
	improvesBedding: false,
	thickensWalls: true,
	removesOverhang: false,
});

materialsMap.set('rock', {
	name: 'rock',
	description: 'A small piece formed from minerals, its hardness making it a great tool to remove overhang from walls.',
	reinforcesStructure: false,
	improvesBedding: false,
	thickensWalls: false,
	removesOverhang: true,
});

materialsMap.set('seashell', {
	name: 'seashell',
	description: 'Hard, protective outer layer by an animal that lives in the sea. Can be used to even out irregularities.',
	reinforcesStructure: false,
	improvesBedding: false,
	thickensWalls: false,
	removesOverhang: true,
});

materialsMap.set('bone', {
	name: 'bone',
	description: 'One of the hard parts of animal\'s skeletons. Good way to get rid of bumps and material sticking out of walls.',
	reinforcesStructure: false,
	improvesBedding: false,
	thickensWalls: false,
	removesOverhang: true,
});


// *rodents incl.: mice, rats, squirrels, prairie dogs, porcupines, beavers, guinea pigs, hamsters, rabbits, hares, pikas
// every animal should have ~3-4 opponents per biome, and be mentioned 9-12 times in total
/** @type {Map<string, import('../typedef').SpeciesMapObject>} */
const speciesMap = new Map();

// actual diet: moose, red deer, roe deer, wild boar, elk, caribou, white-tailed deer, mule deer, rodents*, hares, insectivores, smaller carnivores, waterfowl, lizards, snakes, frogs, large insecets
// actual predators: no real ones, but sometimes large cats (eg eurasian lynx, cougars, siberian tigers), coyotes, elks that try to protect themselves, bears, striped hyenas
speciesMap.set('wolf', {
	name: 'wolf',
	diet: 'omnivore',
	habitat: 'cold',
	biome1OpponentArray: ['rabbit', 'squirrel', 'deer'],
	biome2OpponentArray: ['fox', 'dog', 'goat'],
	biome3OpponentArray: ['bear', 'horse', 'elk'],
});

// actual diet in: hamsters, rats, mice, voles, sometimes martens, european polecat, stoat, weasel, sometimes deer, chamols, hates, rodents*, squirrel galliformes, birds, fish
// actual predators: feral dogs, dingoes, coyotes, caracals, birds of prey
speciesMap.set('cat', {
	name: 'cat',
	diet: 'carnivore',
	habitat: 'cold',
	biome1OpponentArray: ['rabbit', 'squirrel', 'owl'],
	biome2OpponentArray: ['fox', 'bear'],
	biome3OpponentArray: ['wolf', 'dog'],
});

// actual diet: invertebrates such as insects and small vertebrates such as reptiles and birds, raccoons, oppossums, small rodents* like voles, mice and squirrels
// actual predators: wolves, coyotes, leopards, caracals, lynxes, hyena, cougars, bobcats, eagles, owls
speciesMap.set('fox', {
	name: 'fox',
	diet: 'omnivore',
	habitat: 'cold',
	biome1OpponentArray: ['rabbit', 'squirrel', 'owl'],
	biome2OpponentArray: ['cat', 'dog', 'deer'],
	biome3OpponentArray: ['wolf', 'bear'],
});

// actual diet: ungulates such as antelopes and deer, primates such as monkeys, smaller carnivores like black-backed jackal, foxes, genets and cheetah
// actual predators: tiger, lion, hyena, snake, crocodiles
speciesMap.set('leopard', {
	name: 'leopard',
	diet: 'carnivore',
	habitat: 'warm',
	biome1OpponentArray: ['coyote', 'maned wolf', 'mongoose'],
	biome2OpponentArray: ['caracal'],
	biome3OpponentArray: ['tiger', 'lion'],
});

// actual diet: large and medium-sizes mammals such as ungulates, deer, wapiti and wild boars, guar, buffalo, smaller prey such as monkeys, peafowl and other ground-based birds, hares, porcupines and fish, other predators such as dogs, leopards, pythons, bears and crocodiles, lifestock such as cattle, horses and donkeys
// actual predators: leopards, dholes, hyenas, wolves, bears, pythons and crocodiles
speciesMap.set('tiger', {
	name: 'tiger',
	diet: 'carnivore',
	habitat: 'warm',
	biome1OpponentArray: ['coyote', 'maned wolf', 'mongoose'],
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
	biome1OpponentArray: ['rabbit', 'salmon', 'tuna'],
	biome2OpponentArray: ['cat', 'fox', 'dog'],
	biome3OpponentArray: ['wolf', 'horse', 'elk'],
});

speciesMap.set('coyote', {
	name: 'coyote',
	diet: 'omnivore',
	habitat: 'warm',
	biome1OpponentArray: ['caracal', 'maned wolf', 'porcupine'],
	biome2OpponentArray: ['leopard', 'goat'],
	biome3OpponentArray: ['tiger', 'lion'],
});

speciesMap.set('rabbit', {
	name: 'rabbit',
	diet: 'herbivore',
	habitat: 'cold',
	biome1OpponentArray: ['squirrel', 'owl'],
	biome2OpponentArray: ['dog', 'deer', 'otter'],
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
	biome2OpponentArray: ['crab', 'anole'],
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
	biome2OpponentArray: ['tuna', 'salmon', 'mongoose'],
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
	biome2OpponentArray: ['cat', 'fox', 'ferret'],
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
	biome3OpponentArray: ['weasel', 'raccoon', 'hedgehog'],
});

speciesMap.set('cricket', {
	name: 'cricket',
	diet: 'omnivore',
	habitat: 'cold',
	biome1OpponentArray: ['moth', 'beetle'],
	biome2OpponentArray: ['praying mantis', 'bee'],
	biome3OpponentArray: ['weasel', 'owl', 'hedgehog'],
});

speciesMap.set('beetle', {
	name: 'beetle',
	diet: 'omnivore',
	habitat: 'cold',
	biome1OpponentArray: ['cricket', 'moth'],
	biome2OpponentArray: ['praying mantis', 'bee'],
	biome3OpponentArray: ['weasel', 'owl', 'hedgehog'],
});

speciesMap.set('moth', {
	name: 'moth',
	diet: 'omnivore',
	habitat: 'cold',
	biome1OpponentArray: ['moth', 'praying mantis'],
	biome2OpponentArray: ['cricket', 'beetle'],
	biome3OpponentArray: ['bee', 'owl', 'anole'],
});

speciesMap.set('bee', {
	name: 'bee',
	diet: 'herbivore',
	habitat: 'warm',
	biome1OpponentArray: ['cricket', 'beetle'],
	biome2OpponentArray: ['moth', 'praying mantis'],
	biome3OpponentArray: ['bear', 'owl', 'ferret'],
});

speciesMap.set('cougar', {
	name: 'cougar',
	diet: 'carnivore',
	habitat: 'warm',
	biome1OpponentArray: ['deer', 'goat', 'porcupine'],
	biome2OpponentArray: ['elk', 'coyote'],
	biome3OpponentArray: ['bear', 'wolf'],
});

speciesMap.set('frog', {
	name: 'frog',
	diet: 'carnivore',
	habitat: 'cold',
	biome1OpponentArray: ['beetle', 'cricket', 'praying mantis'],
	biome2OpponentArray: ['raccoon', 'fox', 'hedgehog'],
	biome3OpponentArray: ['owl', 'crow', 'otter'],
});

speciesMap.set('crow', {
	name: 'crow',
	diet: 'omnivore',
	habitat: 'cold',
	biome1OpponentArray: ['beetle', 'moth', 'cricket'],
	biome2OpponentArray: ['squirrel', 'rabbit'],
	biome3OpponentArray: ['hawk', 'eagle'],
});

speciesMap.set('king cobra', {
	name: 'king cobra',
	diet: 'carnivore',
	habitat: 'cold',
	biome1OpponentArray: ['frog', 'rabbit', 'hedgehog'],
	biome2OpponentArray: ['gaboon viper', 'cassowary', 'hoatzin'],
	biome3OpponentArray: ['hawk', 'eagle'],
});

speciesMap.set('rat', {
	name: 'rat',
	diet: 'omnivore',
	habitat: 'cold',
	biome1OpponentArray: ['beetle', 'cricket', 'praying mantis'],
	biome2OpponentArray: ['squirrel', 'rabbit', 'raccoon'],
	biome3OpponentArray: ['owl', 'cougar', 'weasel'],
});

speciesMap.set('hedgehog', {
	name: 'hedgehog',
	diet: 'omnivore',
	habitat: 'cold',
	biome1OpponentArray: ['beetle', 'cricket', 'praying mantis'],
	biome2OpponentArray: ['frog', 'rat', 'squirrel'],
	biome3OpponentArray: ['owl', 'eagle', 'weasel'],
});

// actual diet: plants
// actual predators: felids, canids and bears, hawks, sometimes otters
speciesMap.set('beaver', {
	name: 'beaver',
	diet: 'herbivore',
	habitat: 'cold',
	biome1OpponentArray: ['beetle', 'cricket', 'praying mantis'],
	biome2OpponentArray: ['coyote', 'fox', 'weasel'],
	biome3OpponentArray: ['bear', 'hawk', 'wolf'],
});

// actual diet: sedentary animals such as mollusks, worms and insect larvae, fish, amphibians, reptiles, birds and mammals
// actual predators: raccoons, opossums, skunks, sharks, crows, seagulls, kingsnakes, crocodiles, alligators
speciesMap.set('turtle', {
	name: 'turtle',
	diet: 'omnivore',
	habitat: 'warm',
	biome1OpponentArray: ['beetle', 'cricket', 'salmon'],
	biome2OpponentArray: ['raccoon', 'crow', 'weasel'],
	biome3OpponentArray: ['shark', 'fox', 'coyote'],
});

// actual diet: crickets, beetles, ants, flies, grasshoppers, caterpillars, moths, butterflies, arachnids like spiders, sometimes mice, small birds, lizards, fish, shrimp
// actual predators: skinks, snakes, birds, large frogs, lizards, monkeys, carnivorous mammals
speciesMap.set('anole', {
	name: 'anole',
	diet: 'carnivore',
	habitat: 'cold',
	biome1OpponentArray: ['beetle', 'cricket', 'moth'],
	biome2OpponentArray: ['salmon', 'frog', 'owl'],
	biome3OpponentArray: ['weasel', 'king cobra', 'raccoon'],
});

// actual diet: crickets, beetles, ants, flies, grasshoppers, caterpillars, moths, butterflies, arachnids like spiders, sometimes mice, small birds, lizards, fish, shrimp
// actual predators: skinks, snakes, birds, large frogs, lizards, monkeys, carnivorous mammals
speciesMap.set('anole', {
	name: 'anole',
	diet: 'carnivore',
	habitat: 'cold',
	biome1OpponentArray: ['beetle', 'cricket', 'moth'],
	biome2OpponentArray: ['salmon', 'frog', 'owl'],
	biome3OpponentArray: ['weasel', 'king cobra', 'raccoon'],
});

// actual diet: lizard, grub
// actual predators: coyote, cougar, bobcat, bear, wolf, owl, fox, lynx
speciesMap.set('porcupine', {
	name: 'porcupine',
	diet: 'herbivore',
	habitat: 'cold',
	biome1OpponentArray: ['cricket', 'beetle', 'praying mantis'],
	biome2OpponentArray: ['anole', 'owl', 'fox'],
	biome3OpponentArray: ['bear', 'cougar', 'coyote'],
});

// actual diet: small mammals (rodents), birds, reptiles (lizards), eggs, occasionally fruit, insects, crabs, earthworms
// actual predators: hawks, eagles, jackals, big cats, avian predators
speciesMap.set('mongoose', {
	name: 'mongoose',
	diet: 'carnivore',
	habitat: 'warm',
	biome1OpponentArray: ['rat', 'rabbit', 'crab'],
	biome2OpponentArray: ['anole', 'cougar', 'leopard'],
	biome3OpponentArray: ['tiger', 'eagle', 'hawk'],
});

// actual diet: crayfish, other fishes, crabs, frogs, birds, rabbits, rodents
// actual predators: bobcats, alligators, coyotes, raptors
speciesMap.set('otter', {
	name: 'otter',
	diet: 'carnivore',
	habitat: 'water',
	biome1OpponentArray: ['salmon', 'tuna', 'crab'],
	biome2OpponentArray: ['beaver', 'rabbit', 'frog'],
	biome3OpponentArray: ['bear', 'eagle', 'coyote'],
});

// actual diet: mice, rats, voles, quail, chickens, pigeons, grouse, rabbits, frogs, toads, snakes, insects
// actual predators: owls, eagles, hawks, coyotes, badgers, foxes, wolves, bobcats
speciesMap.set('ferret', {
	name: 'ferret',
	diet: 'carnivore',
	habitat: 'cold',
	biome1OpponentArray: ['frog', 'bee', 'rat'],
	biome2OpponentArray: ['owl', 'rabbit', 'weasel'],
	biome3OpponentArray: ['hawk', 'eagle', 'coyote'],
});


module.exports = {

	commonPlantsMap: commonPlantsMap,
	uncommonPlantsMap: uncommonPlantsMap,
	rarePlantsMap: rarePlantsMap,
	specialPlantsMap: specialPlantsMap,
	materialsMap: materialsMap,
	speciesMap: speciesMap,

};
