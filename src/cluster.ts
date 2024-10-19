import { Client, Collection, GatewayIntentBits, Options, Partials } from 'discord.js';
import { Sequelize } from 'sequelize-typescript';
import { readdirSync } from 'fs';
import path from 'path';
import { Api } from '@top-gg/sdk';
import { ContextMenuCommand, SlashCommand, Votes } from './typings/handle';
import { CommonPlantNames, MaterialNames, RarePlantNames, SpecialPlantNames, SpeciesNames, UncommonPlantNames } from './typings/data/general';
import { MaterialInfo, PlantEdibilityType, PlantInfo, SpeciesDietType, SpeciesHabitatType, SpeciesInfo } from './typings/main';
import { Octokit } from '@octokit/rest';
import { execute as executeCommandHandler } from './handlers/commands';
import { execute as executeEventHandler } from './handlers/events';
const { token, bfd_token, bfd_authorization, top_token, top_authorization, dbl_token, dbl_authorization, github_token, database_password } = require('../config.json');
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const bfd = require('bfd-api-redux/src/main');


const tablePath = path.join(__dirname, './models/');
export const sequelize = new Sequelize('pnp', 'postgres', database_password, {
	host: 'localhost',
	dialect: 'postgres',
	define: {
		freezeTableName: true,
	},
	models: readdirSync(tablePath).map(el => tablePath + el),
	logging: (_msg, options: any) => {
		if (
			options &&
			options.instance &&
			options.instance._changed
		) {
			if (options.type === 'UPDATE') {
				const changes = (Array.from(options.instance._changed) as string[]).map((columnName) => {

					const before = options.instance._previousDataValues[columnName];
					const after = options.instance.dataValues[columnName];

					if (Array.isArray(after) && Array.isArray(before)) {
						const countMap = new Map<any, number>();
						for (const val of before) { countMap.set(val, (countMap.get(val) || 0) - 1); }
						for (const val of after) { countMap.set(val, (countMap.get(val) || 0) + 1); }

						const arr = Array.from(countMap.entries());
						const removed = arr
							.filter(([, count]) => count < 0)
							.flatMap(([val, count]) => Array(Math.abs(count)).fill(val));

						const added = arr
							.filter(([, count]) => count > 0)
							.flatMap(([val, count]) => Array(count).fill(val));

						return { column: columnName, removed, added };
					}
					else {
						return { column: columnName, before, after };
					}
				});
				console.log(`${options.instance.constructor.name} ${options.instance.id} updated:`, changes);
			}
			else if (options.type === 'INSERT') {
				const changes: Record<string, any> = { id: options.instance.dataValues.id };
				(Array.from(options.instance._changed) as string[]).forEach((columnName) => {
					changes[columnName] = options.instance.dataValues[columnName];
				});
				console.log(`Created ${options.instance.constructor.name}:`, changes);
			}
			else if (options.type === 'DELETE') {
				console.log(`Deleted ${options.instance.constructor.name} ${options.instance.id}`);
			}
		}
	},
});

sequelize.authenticate()
	.then(function() {

		console.log('Connection has been established successfully.');
		sequelize.sync();
	})
	.catch(function(error) { console.error('Unable to connect to the database:', error); });


export const client = new Client({
	intents: [
		GatewayIntentBits.Guilds,
		GatewayIntentBits.GuildMessages,
		GatewayIntentBits.MessageContent,
		GatewayIntentBits.DirectMessages,
	],
	partials: [
		Partials.Channel,
	],
	allowedMentions: {
		parse: ['users', 'roles'],
		repliedUser: false,
	},
	makeCache: Options.cacheWithLimits({
		...Options.DefaultMakeCacheSettings,
		ApplicationCommandManager: 0,
		BaseGuildEmojiManager: 0,
		GuildBanManager: 0,
		GuildEmojiManager: 0,
		GuildInviteManager: 0,
		GuildScheduledEventManager: 0,
		GuildStickerManager: 0,
		PresenceManager: 0,
		ReactionManager: 0,
		ReactionUserManager: 0,
		StageInstanceManager: 0,
		VoiceStateManager: 0,
	}),
});

export const handle: {
	slashCommands: Collection<string, SlashCommand>;
	contextMenuCommands: Collection<string, ContextMenuCommand>;
	votes: {
		bfd: Votes & { client: typeof bfd; },
		top: Votes & { client: Api | null; },
		dbl: Votes & { client: null; };
	};
} = {
	slashCommands: new Collection<string, SlashCommand>(),
	contextMenuCommands: new Collection<string, ContextMenuCommand>(),
	votes: {
		bfd: { token: bfd_token, authorization: bfd_authorization, client: null },
		top: { token: top_token, authorization: top_authorization, client: null },
		dbl: { token: dbl_token, authorization: dbl_authorization, client: null },
	},
};

export const octokit = new Octokit({
	auth: github_token,
	userAgent: 'paw-and-paper',
});

export const commonPlantsInfo: { [key in CommonPlantNames]: PlantInfo; } = {
	'raspberry': {
		description: 'A tasty berry! Good for the quick hunger.',
		edibility: PlantEdibilityType.Edible,
		healsWounds: false,
		healsInfections: false,
		healsColds: false,
		healsSprains: false,
		healsPoison: false,
		givesEnergy: false,
		increasesMaxCondition: false,
	},
	'garlic': {
		description: 'A nourishing plant in the onion genus.',
		edibility: PlantEdibilityType.Edible,
		healsWounds: false,
		healsInfections: false,
		healsColds: false,
		healsSprains: false,
		healsPoison: false,
		givesEnergy: false,
		increasesMaxCondition: false,
	},
	'herb Robert': {
		description: 'The herb Robert is a common species of plants useful for healing wounds.',
		edibility: PlantEdibilityType.Inedible,
		healsWounds: true,
		healsInfections: false,
		healsColds: false,
		healsSprains: false,
		healsPoison: false,
		givesEnergy: false,
		increasesMaxCondition: false,
	},
	'field scabious': {
		description: 'This pretty flower is used to fight colds.',
		edibility: PlantEdibilityType.Inedible,
		healsWounds: false,
		healsInfections: false,
		healsColds: true,
		healsSprains: false,
		healsPoison: false,
		givesEnergy: false,
		increasesMaxCondition: false,
	},
	'henna': {
		description: 'A flowering plant often used as dye, but also used against infections and inflammations.',
		edibility: PlantEdibilityType.Inedible,
		healsWounds: false,
		healsInfections: true,
		healsColds: false,
		healsSprains: false,
		healsPoison: false,
		givesEnergy: false,
		increasesMaxCondition: false,
	},
	'elderberry': {
		description: 'This berry is poisonous when eaten uncooked, but it helps against colds when used as a medicine.',
		edibility: PlantEdibilityType.Toxic,
		healsWounds: false,
		healsInfections: false,
		healsColds: true,
		healsSprains: false,
		healsPoison: false,
		givesEnergy: false,
		increasesMaxCondition: false,
	},
	'comfrey': {
		description: 'Comfrey is a flowering plant that is toxic when eaten, but heals sprains and swellings when applied directly.',
		edibility: PlantEdibilityType.Toxic,
		healsWounds: false,
		healsInfections: false,
		healsColds: false,
		healsSprains: true,
		healsPoison: false,
		givesEnergy: false,
		increasesMaxCondition: false,
	},
	'marigold': {
		description: 'This flowering plant is great when used to heal infection.',
		edibility: PlantEdibilityType.Inedible,
		healsWounds: false,
		healsInfections: true,
		healsColds: false,
		healsSprains: false,
		healsPoison: false,
		givesEnergy: false,
		increasesMaxCondition: false,
	},
	'common hollyhock': {
		description: 'A flower frequently used to fight wounds and bruises.',
		edibility: PlantEdibilityType.Inedible,
		healsWounds: true,
		healsInfections: false,
		healsColds: false,
		healsSprains: false,
		healsPoison: false,
		givesEnergy: false,
		increasesMaxCondition: false,
	},
	'arnica': {
		description: 'This plant of the sunflower family contains a toxin and shouldn\'t be eaten, though it helps reduce pain from sprains.',
		edibility: PlantEdibilityType.Toxic,
		healsWounds: false,
		healsInfections: false,
		healsColds: false,
		healsSprains: true,
		healsPoison: false,
		givesEnergy: false,
		increasesMaxCondition: false,
	},
	'clover': {
		description: 'Several plants of the genus Trifolium. A common source of nourishment.',
		edibility: PlantEdibilityType.Edible,
		healsWounds: false,
		healsInfections: false,
		healsColds: false,
		healsSprains: false,
		healsPoison: false,
		givesEnergy: false,
		increasesMaxCondition: false,
	},
	'passion fruit': {
		description: 'Vine species of the passion flower. Very nutritious.',
		edibility: PlantEdibilityType.Edible,
		healsWounds: false,
		healsInfections: false,
		healsColds: false,
		healsSprains: false,
		healsPoison: false,
		givesEnergy: false,
		increasesMaxCondition: false,
	},
	'bergamot orange': {
		description: 'A citrus fruit the size of an orange. Less sour than lemon, but more bitter than grapefruit.',
		edibility: PlantEdibilityType.Edible,
		healsWounds: false,
		healsInfections: false,
		healsColds: false,
		healsSprains: false,
		healsPoison: false,
		givesEnergy: false,
		increasesMaxCondition: false,
	},
	'cicely': {
		description: 'This plant grows 6ft 6in (2m) high. Both the leaves and the roots are edible.',
		edibility: PlantEdibilityType.Edible,
		healsWounds: false,
		healsInfections: false,
		healsColds: false,
		healsSprains: false,
		healsPoison: false,
		givesEnergy: false,
		increasesMaxCondition: false,
	},
	'acorn': {
		description: 'This nut is highly nutritious and therefore serves as an excellent source of food.',
		edibility: PlantEdibilityType.Edible,
		healsWounds: false,
		healsInfections: false,
		healsColds: false,
		healsSprains: false,
		healsPoison: false,
		givesEnergy: false,
		increasesMaxCondition: false,
	},
	'rhodiola': {
		description: 'The root of a perennial plant, searched after as a food source and for its ability to help fight fatigue and exhaustion.',
		edibility: PlantEdibilityType.Edible,
		healsWounds: false,
		healsInfections: false,
		healsColds: false,
		healsSprains: false,
		healsPoison: false,
		givesEnergy: true,
		increasesMaxCondition: false,
	},
};

export const uncommonPlantsInfo: { [key in UncommonPlantNames]: PlantInfo } = {
	'solomon\'s seal': {
		description: 'This flowering plant is a great source of food, but also excellent for healing colds as well as wounds!',
		edibility: PlantEdibilityType.Edible,
		healsWounds: true,
		healsInfections: false,
		healsColds: true,
		healsSprains: false,
		healsPoison: false,
		givesEnergy: false,
		increasesMaxCondition: false,
	},
	'gotu kola': {
		description: 'A vegetable often used to treat infections, as well as being very energizing!',
		edibility: PlantEdibilityType.Edible,
		healsWounds: false,
		healsInfections: true,
		healsColds: false,
		healsSprains: false,
		healsPoison: false,
		givesEnergy: true,
		increasesMaxCondition: false,
	},
	'great mullein': {
		description: 'The great mullein is a high growing biennal plant not only used for consumption but also for colds and sprains.',
		edibility: PlantEdibilityType.Edible,
		healsWounds: false,
		healsInfections: false,
		healsColds: true,
		healsSprains: true,
		healsPoison: false,
		givesEnergy: false,
		increasesMaxCondition: false,
	},
	'purple coneflower': {
		description: 'This flower is not only part of the sunflower family, but also a treatment against colds, infections, and hunger!',
		edibility: PlantEdibilityType.Edible,
		healsWounds: false,
		healsInfections: true,
		healsColds: true,
		healsSprains: false,
		healsPoison: false,
		givesEnergy: false,
		increasesMaxCondition: false,
	},
	'field horsetail': {
		description: 'A perenniel plant that is useful against wounds and sprains, but toxic if consumed.',
		edibility: PlantEdibilityType.Toxic,
		healsWounds: true,
		healsInfections: false,
		healsColds: false,
		healsSprains: true,
		healsPoison: false,
		givesEnergy: false,
		increasesMaxCondition: false,
	},
	'bay laurel': {
		description: 'An aromatic large shrub used to treat wounds and sprains!',
		edibility: PlantEdibilityType.Edible,
		healsWounds: true,
		healsInfections: false,
		healsColds: false,
		healsSprains: true,
		healsPoison: false,
		givesEnergy: false,
		increasesMaxCondition: false,
	},
	'chick weed': {
		description: 'The chick weed is not only very tasty, but also able to heal wounds and sprains.',
		edibility: PlantEdibilityType.Edible,
		healsWounds: true,
		healsInfections: false,
		healsColds: false,
		healsSprains: true,
		healsPoison: false,
		givesEnergy: false,
		increasesMaxCondition: false,
	},
	'yerba mate': {
		description: 'This plants leaves are useful for healing infections, but also energizing due to it containing caffeine.',
		edibility: PlantEdibilityType.Edible,
		healsWounds: false,
		healsInfections: true,
		healsColds: false,
		healsSprains: false,
		healsPoison: false,
		givesEnergy: true,
		increasesMaxCondition: false,
	},
};

export const rarePlantsInfo: { [key in RarePlantNames]: PlantInfo } = {
	'ribwort plantain': {
		description: 'A weed for treating wounds, colds and poison! Highly nutritious.',
		edibility: PlantEdibilityType.Edible,
		healsWounds: true,
		healsInfections: false,
		healsColds: false,
		healsSprains: true,
		healsPoison: true,
		givesEnergy: false,
		increasesMaxCondition: false,
	},
	'charcoal-tree leaves': {
		description: 'These leaves do wonders against poison, wounds and colds, as well as being very tasty.',
		edibility: PlantEdibilityType.Edible,
		healsWounds: true,
		healsInfections: false,
		healsColds: true,
		healsSprains: false,
		healsPoison: true,
		givesEnergy: false,
		increasesMaxCondition: false,
	},
	'marsh mallow': {
		description: 'This sweet tasting, energizing plant is very effective against infections, sprains!',
		edibility: PlantEdibilityType.Edible,
		healsWounds: false,
		healsInfections: true,
		healsColds: false,
		healsSprains: true,
		healsPoison: false,
		givesEnergy: true,
		increasesMaxCondition: false,
	},
};

export const specialPlantsInfo: { [key in SpecialPlantNames]: PlantInfo } = {
	'black-eyed Susan': {
		description: 'This flower from the sunflower family is thought to give a temporary boost to one\'s maximum health, energy, hunger or thirst.',
		edibility: PlantEdibilityType.Edible,
		healsWounds: false,
		healsInfections: false,
		healsColds: false,
		healsSprains: false,
		healsPoison: false,
		givesEnergy: false,
		increasesMaxCondition: true,
	},
	'red clover': {
		description: 'A plant so rich in nutrients that it can be planted next to saplings to keep them from dying.',
		edibility: PlantEdibilityType.Edible,
		healsWounds: false,
		healsInfections: false,
		healsColds: false,
		healsSprains: false,
		healsPoison: false,
		givesEnergy: false,
		increasesMaxCondition: false,
	},
};

export const materialsInfo: { [key in MaterialNames]: MaterialInfo } = {
	'stick': {
		description: 'These are not the sturdiest material out there, but they can help holding together constructions.',
		reinforcesStructure: true,
		improvesBedding: false,
		thickensWalls: false,
		removesOverhang: false,
	},
	'pine cone': {
		description: 'The seed-bearing fruit of the pine tree. The wooden exterior and shape make it great for reinforcing structures.',
		reinforcesStructure: true,
		improvesBedding: false,
		thickensWalls: false,
		removesOverhang: false,
	},
	'root': {
		description: 'Remainders of dead trees. With their toughness as support, they can be like a skeleton or frame of a structure.',
		reinforcesStructure: true,
		improvesBedding: false,
		thickensWalls: false,
		removesOverhang: false,
	},
	'moss': {
		description: 'A soft and easy to maintain plant that makes for a great floor component.',
		reinforcesStructure: false,
		improvesBedding: true,
		thickensWalls: false,
		removesOverhang: false,
	},
	'leaf': {
		description: 'Foilage is not only vital to most plants, but also has a great texture and acts as a dampening effect when walked over.',
		reinforcesStructure: false,
		improvesBedding: true,
		thickensWalls: false,
		removesOverhang: false,
	},
	'algae': {
		description: 'Seaweed is not only pretty, but also spongy and comfortable, making it perfect as ground material.',
		reinforcesStructure: false,
		improvesBedding: true,
		thickensWalls: false,
		removesOverhang: false,
	},
	'clay': {
		description: 'This type of dirt is deformable when wet, but tough and brittle when dry, making it a great thickening material for walls.',
		reinforcesStructure: false,
		improvesBedding: false,
		thickensWalls: true,
		removesOverhang: false,
	},
	'vine': {
		description: 'The long-growing plant will spread and twist around walls. They are not robust, but their leaves will thicken whatever they are growing on.',
		reinforcesStructure: false,
		improvesBedding: false,
		thickensWalls: true,
		removesOverhang: false,
	},
	'soil': {
		description: 'This common material is easy to deform, but still strong when pressed together, making it perfect for thickening walls and ceilings.',
		reinforcesStructure: false,
		improvesBedding: false,
		thickensWalls: true,
		removesOverhang: false,
	},
	'rock': {
		description: 'A small piece formed from minerals, its hardness making it a great tool to remove overhang from and even out walls.',
		reinforcesStructure: false,
		improvesBedding: false,
		thickensWalls: false,
		removesOverhang: true,
	},
	'seashell': {
		description: 'Hard, protective outer layer by an animal that lives in the sea. Can be used to even out irregularities .',
		reinforcesStructure: false,
		improvesBedding: false,
		thickensWalls: false,
		removesOverhang: true,
	},
	'bone': {
		description: 'One of the hard parts of animal\'s skeletons. Good way to get rid of bumps and material sticking out of walls to even them out.',
		reinforcesStructure: false,
		improvesBedding: false,
		thickensWalls: false,
		removesOverhang: true,
	},
};

export const speciesInfo: { [key in SpeciesNames]: SpeciesInfo } = {
	// actual diet: moose, red deer, roe deer, wild boar, elk, caribou, white-tailed deer, mule deer, rodents*, hares, insectivores, smaller carnivores, waterfowl, lizards, snakes, frogs, large insecets
	// actual predators: no real ones, but sometimes large cats (eg eurasian lynx, cougars, siberian tigers), coyotes, elks that try to protect themselves, bears, striped hyenas
	'wolf': {
		diet: SpeciesDietType.Omnivore,
		habitat: SpeciesHabitatType.Cold,
		biome1OpponentArray: ['rabbit', 'squirrel', 'deer'],
		biome2OpponentArray: ['fox', 'dog', 'goat'],
		biome3OpponentArray: ['bear', 'horse', 'elk'],
	},
	// actual diet in: hamsters, rats, mice, voles, sometimes martens, european polecat, stoat, weasel, sometimes deer, chamols, hates, rodents*, squirrel galliformes, birds, fish
	// actual predators: feral dogs, dingoes, coyotes, caracals, birds of prey
	'cat': {
		diet: SpeciesDietType.Carnivore,
		habitat: SpeciesHabitatType.Cold,
		biome1OpponentArray: ['rabbit', 'squirrel', 'owl'],
		biome2OpponentArray: ['fox', 'bear'],
		biome3OpponentArray: ['wolf', 'dog'],
	},
	// actual diet: invertebrates such as insects and small vertebrates such as reptiles and birds, raccoons, oppossums, small rodents* like voles, mice and squirrels
	// actual predators: wolves, coyotes, leopards, caracals, lynxes, hyena, cougars, bobcats, eagles, owls
	'fox': {
		diet: SpeciesDietType.Omnivore,
		habitat: SpeciesHabitatType.Cold,
		biome1OpponentArray: ['rabbit', 'squirrel', 'owl'],
		biome2OpponentArray: ['cat', 'dog', 'deer'],
		biome3OpponentArray: ['wolf', 'bear'],
	},
	// actual diet: ungulates such as antelopes and deer, primates such as monkeys, smaller carnivores like black-backed jackal, foxes, genets and cheetah
	// actual predators: tiger, lion, hyena, snake, crocodiles
	'leopard': {
		diet: SpeciesDietType.Carnivore,
		habitat: SpeciesHabitatType.Warm,
		biome1OpponentArray: ['coyote', 'maned wolf', 'mongoose'],
		biome2OpponentArray: ['caracal', 'warthog'],
		biome3OpponentArray: ['tiger', 'lion'],
	},
	// actual diet: large and medium-sizes mammals such as ungulates, deer, wapiti and wild boars, guar, buffalo, smaller prey such as monkeys, peafowl and other ground-based birds, hares, porcupines and fish, other predators such as dogs, leopards, pythons, bears and crocodiles, lifestock such as cattle, horses and donkeys
	// actual predators: leopards, dholes, hyenas, wolves, bears, pythons and crocodiles
	'tiger': {
		diet: SpeciesDietType.Carnivore,
		habitat: SpeciesHabitatType.Warm,
		biome1OpponentArray: ['coyote', 'maned wolf', 'mongoose'],
		biome2OpponentArray: ['leopard', 'caracal'],
		biome3OpponentArray: ['lion'],
	},
	'shark': {
		diet: SpeciesDietType.Carnivore,
		habitat: SpeciesHabitatType.Water,
		biome1OpponentArray: ['salmon', 'tuna', 'squid'],
		biome2OpponentArray: ['seal', 'crab'],
		biome3OpponentArray: ['orca', 'humpback whale'],
	},
	'caracal': {
		diet: SpeciesDietType.Carnivore,
		habitat: SpeciesHabitatType.Warm,
		biome1OpponentArray: ['coyote', 'maned wolf'],
		biome2OpponentArray: ['leopard', 'tiger'],
		biome3OpponentArray: ['lion'],
	},
	'bear': {
		diet: SpeciesDietType.Omnivore,
		habitat: SpeciesHabitatType.Cold,
		biome1OpponentArray: ['rabbit', 'salmon', 'tuna'],
		biome2OpponentArray: ['cat', 'fox', 'dog'],
		biome3OpponentArray: ['wolf', 'horse', 'elk'],
	},
	'coyote': {
		diet: SpeciesDietType.Omnivore,
		habitat: SpeciesHabitatType.Warm,
		biome1OpponentArray: ['caracal', 'maned wolf', 'porcupine'],
		biome2OpponentArray: ['leopard', 'goat'],
		biome3OpponentArray: ['tiger', 'lion'],
	},
	'rabbit': {
		diet: SpeciesDietType.Herbivore,
		habitat: SpeciesHabitatType.Cold,
		biome1OpponentArray: ['squirrel', 'owl'],
		biome2OpponentArray: ['dog', 'deer', 'otter'],
		biome3OpponentArray: ['wolf', 'cat', 'bear'],
	},
	'squirrel': {
		diet: SpeciesDietType.Omnivore,
		habitat: SpeciesHabitatType.Cold,
		biome1OpponentArray: ['rabbit', 'owl'],
		biome2OpponentArray: ['dog', 'deer'],
		biome3OpponentArray: ['wolf', 'cat', 'bear'],
	},
	'lion': {
		diet: SpeciesDietType.Carnivore,
		habitat: SpeciesHabitatType.Warm,
		biome1OpponentArray: ['coyote', 'maned wolf', 'warthog'],
		biome2OpponentArray: ['leopard', 'caracal'],
		biome3OpponentArray: ['tiger'],
	},
	'seal': {
		diet: SpeciesDietType.Carnivore,
		habitat: SpeciesHabitatType.Water,
		biome1OpponentArray: ['salmon', 'tuna', 'squid'],
		biome2OpponentArray: ['bear', 'crab'],
		biome3OpponentArray: ['shark', 'orca'],
	},
	'salmon': {
		diet: SpeciesDietType.Carnivore,
		habitat: SpeciesHabitatType.Water,
		biome1OpponentArray: ['squid'],
		biome2OpponentArray: ['crab', 'anole'],
		biome3OpponentArray: ['bear', 'seal', 'owl'],
	},
	'tuna': {
		diet: SpeciesDietType.Carnivore,
		habitat: SpeciesHabitatType.Water,
		biome1OpponentArray: ['salmon', 'squid'],
		biome2OpponentArray: ['crab'],
		biome3OpponentArray: ['bear', 'seal', 'owl'],
	},
	'squid': {
		diet: SpeciesDietType.Carnivore,
		habitat: SpeciesHabitatType.Water,
		biome1OpponentArray: ['crab'],
		biome2OpponentArray: ['tuna', 'salmon'],
		biome3OpponentArray: ['shark', 'seal', 'owl'],
	},
	'crab': {
		diet: SpeciesDietType.Omnivore,
		habitat: SpeciesHabitatType.Water,
		biome1OpponentArray: ['squid'],
		biome2OpponentArray: ['tuna', 'salmon', 'mongoose'],
		biome3OpponentArray: ['bear', 'seal', 'owl'],
	},
	'orca': {
		diet: SpeciesDietType.Carnivore,
		habitat: SpeciesHabitatType.Water,
		biome1OpponentArray: ['salmon', 'tuna', 'squid'],
		biome2OpponentArray: ['seal', 'crab'],
		biome3OpponentArray: ['shark', 'humpback whale'],
	},
	'maned wolf': {
		diet: SpeciesDietType.Omnivore,
		habitat: SpeciesHabitatType.Warm,
		biome1OpponentArray: ['caracal', 'coyote'],
		biome2OpponentArray: ['leopard', 'goat'],
		biome3OpponentArray: ['tiger', 'lion'],
	},
	'dog': {
		diet: SpeciesDietType.Omnivore,
		habitat: SpeciesHabitatType.Cold,
		biome1OpponentArray: ['rabbit', 'squirrel', 'deer'],
		biome2OpponentArray: ['wolf', 'fox', 'warthog'],
		biome3OpponentArray: ['cat', 'bear'],
	},
	'owl': {
		diet: SpeciesDietType.Carnivore,
		habitat: SpeciesHabitatType.Cold,
		biome1OpponentArray: ['rabbit', 'squirrel', 'moth', 'beetle'],
		biome2OpponentArray: ['cat', 'fox', 'tropical parrot'],
		biome3OpponentArray: ['wolf', 'bear'],
	},
	'deer': {
		diet: SpeciesDietType.Herbivore,
		habitat: SpeciesHabitatType.Cold,
		biome1OpponentArray: ['rabbit', 'squirrel'],
		biome2OpponentArray: ['fox', 'owl', 'warthog'],
		biome3OpponentArray: ['wolf', 'bear', 'dog'],
	},
	'penguin': {
		diet: SpeciesDietType.Carnivore,
		habitat: SpeciesHabitatType.Cold,
		biome1OpponentArray: ['salmon', 'tuna', 'squid', 'crab'],
		biome2OpponentArray: ['dog', 'cat', 'fox'],
		biome3OpponentArray: ['shark', 'seal', 'orca'],
	},
	'gaboon viper': {
		diet: SpeciesDietType.Carnivore,
		habitat: SpeciesHabitatType.Warm,
		biome1OpponentArray: ['cat', 'rabbit', 'owl'],
		biome2OpponentArray: ['leopard', 'caracal'],
		biome3OpponentArray: ['lion', 'tiger'],
	},
	'hoatzin': {
		diet: SpeciesDietType.Herbivore,
		habitat: SpeciesHabitatType.Warm,
		biome1OpponentArray: ['squirrel', 'rabbit', 'goat'],
		biome2OpponentArray: ['cat', 'weasel'],
		biome3OpponentArray: ['eagle', 'hawk', 'cassowary'],
	},
	'weasel': {
		diet: SpeciesDietType.Carnivore,
		habitat: SpeciesHabitatType.Warm,
		biome1OpponentArray: ['squirrel', 'rabbit', 'cricket', 'praying mantis'],
		biome2OpponentArray: ['cat', 'fox', 'ferret'],
		biome3OpponentArray: ['owl', 'gaboon viper'],
	},
	'hawk': {
		diet: SpeciesDietType.Carnivore,
		habitat: SpeciesHabitatType.Warm,
		biome1OpponentArray: ['squirrel', 'rabbit', 'goat'],
		biome2OpponentArray: ['owl', 'raccoon', 'kinkajou'],
		biome3OpponentArray: ['eagle', 'gaboon viper', 'cassowary'],
	},
	'eagle': {
		diet: SpeciesDietType.Carnivore,
		habitat: SpeciesHabitatType.Warm,
		biome1OpponentArray: ['squirrel', 'rabbit', 'goat'],
		biome2OpponentArray: ['bear', 'raccoon', 'kinkajou'],
		biome3OpponentArray: ['hawk', 'gaboon viper', 'cassowary'],
	},
	'raccoon': {
		diet: SpeciesDietType.Omnivore,
		habitat: SpeciesHabitatType.Cold,
		biome1OpponentArray: ['salmon', 'rabbit', 'praying mantis'],
		biome2OpponentArray: ['owl', 'fox', 'cat'],
		biome3OpponentArray: ['coyote', 'wolf'],
	},
	'horse': {
		diet: SpeciesDietType.Herbivore,
		habitat: SpeciesHabitatType.Cold,
		biome1OpponentArray: ['cat', 'fox'],
		biome2OpponentArray: ['deer', 'dog'],
		biome3OpponentArray: ['bear', 'wolf', 'elk'],
	},
	'elk': {
		diet: SpeciesDietType.Herbivore,
		habitat: SpeciesHabitatType.Cold,
		biome1OpponentArray: ['cat', 'fox'],
		biome2OpponentArray: ['deer', 'dog'],
		biome3OpponentArray: ['bear', 'wolf', 'horse'],
	},
	'cassowary': {
		diet: SpeciesDietType.Omnivore,
		habitat: SpeciesHabitatType.Warm,
		biome1OpponentArray: ['maned wolf', 'dog'],
		biome2OpponentArray: ['hoatzin', 'gaboon viper'],
		biome3OpponentArray: ['hawk', 'eagle'],
	},
	'humpback whale': {
		diet: SpeciesDietType.Omnivore,
		habitat: SpeciesHabitatType.Water,
		biome1OpponentArray: ['salmon', 'tuna', 'squid'],
		biome2OpponentArray: ['seal', 'crab'],
		biome3OpponentArray: ['orca', 'shark'],
	},
	'goat': {
		diet: SpeciesDietType.Herbivore,
		habitat: SpeciesHabitatType.Cold,
		biome1OpponentArray: ['wolf', 'bear', 'maned wolf'],
		biome2OpponentArray: ['fox', 'eagle'],
		biome3OpponentArray: ['dog', 'coyote', 'snow leopard'],
	},
	'kinkajou': {
		diet: SpeciesDietType.Omnivore,
		habitat: SpeciesHabitatType.Warm,
		biome1OpponentArray: ['crab', 'hoatzin', 'salmon'],
		biome2OpponentArray: ['hawk', 'eagle'],
		biome3OpponentArray: ['gaboon viper', 'lion'],
	},
	'praying mantis': {
		diet: SpeciesDietType.Carnivore,
		habitat: SpeciesHabitatType.Cold,
		biome1OpponentArray: ['cricket', 'beetle'],
		biome2OpponentArray: ['moth', 'bee'],
		biome3OpponentArray: ['weasel', 'raccoon', 'hedgehog'],
	},
	'cricket': {
		diet: SpeciesDietType.Omnivore,
		habitat: SpeciesHabitatType.Cold,
		biome1OpponentArray: ['moth', 'beetle'],
		biome2OpponentArray: ['praying mantis', 'bee'],
		biome3OpponentArray: ['weasel', 'owl', 'hedgehog'],
	},
	'beetle': {
		diet: SpeciesDietType.Omnivore,
		habitat: SpeciesHabitatType.Cold,
		biome1OpponentArray: ['cricket', 'moth'],
		biome2OpponentArray: ['praying mantis', 'bee'],
		biome3OpponentArray: ['weasel', 'owl', 'hedgehog'],
	},
	'moth': {
		diet: SpeciesDietType.Omnivore,
		habitat: SpeciesHabitatType.Cold,
		biome1OpponentArray: ['moth', 'praying mantis'],
		biome2OpponentArray: ['cricket', 'beetle'],
		biome3OpponentArray: ['bee', 'owl', 'anole'],
	},
	'bee': {
		diet: SpeciesDietType.Herbivore,
		habitat: SpeciesHabitatType.Warm,
		biome1OpponentArray: ['cricket', 'beetle'],
		biome2OpponentArray: ['moth', 'praying mantis'],
		biome3OpponentArray: ['bear', 'owl', 'ferret'],
	},
	'cougar': {
		diet: SpeciesDietType.Carnivore,
		habitat: SpeciesHabitatType.Warm,
		biome1OpponentArray: ['deer', 'goat', 'porcupine'],
		biome2OpponentArray: ['elk', 'coyote'],
		biome3OpponentArray: ['bear', 'wolf'],
	},
	'frog': {
		diet: SpeciesDietType.Carnivore,
		habitat: SpeciesHabitatType.Cold,
		biome1OpponentArray: ['beetle', 'cricket', 'praying mantis'],
		biome2OpponentArray: ['raccoon', 'fox', 'hedgehog'],
		biome3OpponentArray: ['owl', 'crow', 'otter'],
	},
	'crow': {
		diet: SpeciesDietType.Omnivore,
		habitat: SpeciesHabitatType.Cold,
		biome1OpponentArray: ['beetle', 'moth', 'cricket'],
		biome2OpponentArray: ['squirrel', 'rabbit'],
		biome3OpponentArray: ['hawk', 'eagle', 'gila monster'],
	},
	'king cobra': {
		diet: SpeciesDietType.Carnivore,
		habitat: SpeciesHabitatType.Warm,
		biome1OpponentArray: ['frog', 'rabbit', 'hedgehog'],
		biome2OpponentArray: ['gaboon viper', 'cassowary', 'hoatzin'],
		biome3OpponentArray: ['hawk', 'eagle'],
	},
	'rat': {
		diet: SpeciesDietType.Omnivore,
		habitat: SpeciesHabitatType.Cold,
		biome1OpponentArray: ['beetle', 'cricket', 'praying mantis'],
		biome2OpponentArray: ['squirrel', 'rabbit', 'raccoon'],
		biome3OpponentArray: ['owl', 'cougar', 'weasel'],
	},
	'hedgehog': {
		diet: SpeciesDietType.Omnivore,
		habitat: SpeciesHabitatType.Cold,
		biome1OpponentArray: ['beetle', 'cricket', 'praying mantis'],
		biome2OpponentArray: ['frog', 'rat', 'squirrel'],
		biome3OpponentArray: ['vampire bat', 'eagle', 'weasel'],
	},
	// actual diet: plants
	// actual predators: felids, canids and bears, hawks, sometimes otters
	'beaver': {
		diet: SpeciesDietType.Herbivore,
		habitat: SpeciesHabitatType.Cold,
		biome1OpponentArray: ['beetle', 'cricket', 'praying mantis'],
		biome2OpponentArray: ['coyote', 'fox', 'weasel'],
		biome3OpponentArray: ['bear', 'hawk', 'wolf'],
	},
	// actual diet: sedentary animals such as mollusks, worms and insect larvae, fish, amphibians, reptiles, birds and mammals
	// actual predators: raccoons, opossums, skunks, sharks, crows, seagulls, kingsnakes, crocodiles, alligators
	'turtle': {
		diet: SpeciesDietType.Omnivore,
		habitat: SpeciesHabitatType.Warm,
		biome1OpponentArray: ['beetle', 'cricket', 'salmon'],
		biome2OpponentArray: ['raccoon', 'crow', 'weasel'],
		biome3OpponentArray: ['shark', 'fox', 'coyote'],
	},
	// actual diet: crickets, beetles, ants, flies, grasshoppers, caterpillars, moths, butterflies, arachnids like spiders, sometimes mice, small birds, lizards, fish, shrimp
	// actual predators: skinks, snakes, birds, large frogs, lizards, monkeys, carnivorous mammals
	'anole': {
		diet: SpeciesDietType.Carnivore,
		habitat: SpeciesHabitatType.Cold,
		biome1OpponentArray: ['beetle', 'cricket', 'moth'],
		biome2OpponentArray: ['salmon', 'frog', 'gila monster'],
		biome3OpponentArray: ['weasel', 'king cobra', 'raccoon'],
	},
	// actual diet: lizard, grub
	// actual predators: coyote, cougar, bobcat, bear, wolf, owl, fox, lynx
	'porcupine': {
		diet: SpeciesDietType.Herbivore,
		habitat: SpeciesHabitatType.Cold,
		biome1OpponentArray: ['cricket', 'beetle', 'praying mantis'],
		biome2OpponentArray: ['anole', 'owl', 'fox'],
		biome3OpponentArray: ['bear', 'cougar', 'coyote'],
	},
	// actual diet: small mammals (rodents), birds, reptiles (lizards), eggs, occasionally fruit, insects, crabs, earthworms
	// actual predators: hawks, eagles, jackals, big cats, avian predators
	'mongoose': {
		diet: SpeciesDietType.Carnivore,
		habitat: SpeciesHabitatType.Warm,
		biome1OpponentArray: ['rat', 'rabbit', 'crab'],
		biome2OpponentArray: ['anole', 'cougar', 'leopard'],
		biome3OpponentArray: ['tiger', 'eagle', 'hawk'],
	},
	// actual diet: crayfish, other fishes, crabs, frogs, birds, rabbits, rodents
	// actual predators: bobcats, alligators, coyotes, raptors
	'otter': {
		diet: SpeciesDietType.Carnivore,
		habitat: SpeciesHabitatType.Water,
		biome1OpponentArray: ['salmon', 'tuna', 'crab'],
		biome2OpponentArray: ['beaver', 'rabbit', 'frog'],
		biome3OpponentArray: ['bear', 'eagle', 'coyote'],
	},
	// actual diet: mice, rats, voles, quail, chickens, pigeons, grouse, rabbits, frogs, toads, snakes, insects
	// actual predators: owls, eagles, hawks, coyotes, badgers, foxes, wolves, bobcats
	'ferret': {
		diet: SpeciesDietType.Carnivore,
		habitat: SpeciesHabitatType.Cold,
		biome1OpponentArray: ['frog', 'bee', 'rat'],
		biome2OpponentArray: ['owl', 'rabbit', 'weasel'],
		biome3OpponentArray: ['hawk', 'eagle', 'coyote'],
	},
	// actual diet: Leaves, fruits, vegetables, nuts, snails, insects, clay soil
	// actual predators: Larger birds, snakes, monkeys, and sometimes eagles, hawks, and falcons
	'tropical parrot': {
		diet: SpeciesDietType.Omnivore,
		habitat: SpeciesHabitatType.Warm,
		biome1OpponentArray: ['beetle', 'bee', 'cricket'],
		biome2OpponentArray: ['owl', 'mongoose', 'hoatzin'],
		biome3OpponentArray: ['hawk', 'eagle', 'gaboon viper'],
	},
	// actual diet: grasses, tubers, roots, bulbs, rhizomes, bark, insects, fruit, leaves, berries, carrion (rarely), dung
	// actual predators: humans, lions, leopards, cheetahs, crocodiles, wild dogs, hyenas, birds of prey
	'warthog': {
		diet: SpeciesDietType.Omnivore,
		habitat: SpeciesHabitatType.Warm,
		biome1OpponentArray: ['frog', 'rat', 'hedgehog'],
		biome2OpponentArray: ['owl', 'deer', 'dog'],
		biome3OpponentArray: ['snow leopard', 'hawk', 'lion'],
	},
	// actual diet: small mammals (such as young rabbits, hares, mice, ground squirrels, and other rodents), small birds, snakes, lizards, frogs, insects, other invertebrates, carrion, and the eggs of birds, lizards, snakes, and tortoises
	// actual predators: foxes, mountain lions, coyotes and birds of prey
	'gila monster': {
		diet: SpeciesDietType.Carnivore,
		habitat: SpeciesHabitatType.Warm,
		biome1OpponentArray: ['crow', 'rat', 'beaver'],
		biome2OpponentArray: ['fox', 'frog', 'anole'],
		biome3OpponentArray: ['lion', 'hawk', 'coyote'],
	},
	// actual diet: blood from cows, pigs, horses, goats, chickens, tapirs, small wild mammals, wild birds
	// actual predators: Eagles, Hawks, humans
	'vampire bat': {
		diet: SpeciesDietType.Carnivore,
		habitat: SpeciesHabitatType.Warm,
		biome1OpponentArray: ['beetle', 'moth', 'cricket'],
		biome2OpponentArray: ['rat', 'frog', 'hedgehog'],
		biome3OpponentArray: ['eagle', 'hawk'],
	},
	// actual diet: Wild goat, domestic goats, blue sheep, ibex, Himalayan tahr, marmot, pika, hares, small rodents and game birds. domestic livestock. Sometimes eat vegetation is food is hard to find
	// actual predators: Hawks, other snow leopards
	'snow leopard': {
		diet: SpeciesDietType.Carnivore,
		habitat: SpeciesHabitatType.Cold,
		biome1OpponentArray: ['rat', 'beaver', 'rabbit'],
		biome2OpponentArray: ['goat', 'deer', 'warthog'],
		biome3OpponentArray: ['hawk', 'snow leopard'],
	},
};

executeEventHandler()
	.then(function() {
		executeCommandHandler();
		client.login(token);
	});