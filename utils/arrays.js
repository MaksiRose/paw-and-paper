const commonPlantNamesArray = ['raspberry', 'garlic', 'herb Robert', 'field scabious', 'henna', 'elderberry', 'comfrey', 'marigold', 'common hollyhock', 'neem', 'clover', 'passion fruit', 'bergamot orange', 'cicely', 'acorn', 'rhodiola'];
const commonPlantEdibalityArray = ['e', 'e', 'i', 'i', 'i', 't', 't', 'e', 'i', 'i', 'e', 'e', 'e', 'e', 'e', 'e'];
const commonPlantHealsWoundsArray = [false, false, true, true, false, false, false, true, false, false, false, false, false, false, false, false];
const commonPlantHealsInfectionsArray = [false, false, false, false, true, true, true, false, true, true, false, false, false, false, false, false];
const commonPlantHealsColdsArray = [false, true, false, true, false, true, false, false, false, false, false, false, false, true, false, false];
const commonPlantHealsPoisonArray = [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false];
const commonPlantHealsStrainsArray = [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false];

const commonPlantGivesEnergyArray = [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, true];

const commonPlantDescriptionsArray = [];

commonPlantDescriptionsArray[0] = 'A tasty berry! Good for the quick hunger.';
commonPlantDescriptionsArray[1] = 'A flowering plant in the onion genus. Nourishing and good against colds.';
commonPlantDescriptionsArray[2] = 'The herb Robert is a common species of plants useful for healing wounds.';
commonPlantDescriptionsArray[3] = 'This flower is used to fight coughs, sore throats and common colds as well as wounds.';
commonPlantDescriptionsArray[4] = 'A flowering plant often used as dye, but also used against infections, bruises and swelling.';
commonPlantDescriptionsArray[5] = 'This berry is poisonous when uncooked, but it helps against infections and colds when used as a medicine.';
commonPlantDescriptionsArray[6] = 'Comfrey is a flowering plant that is toxic when eaten, but heals infections when applied directly.';
commonPlantDescriptionsArray[7] = 'This flowering plant is not only tasty, but also able to heal wounds.';
commonPlantDescriptionsArray[8] = 'A flower frequently used to fight infections and inflammations.';
commonPlantDescriptionsArray[9] = 'As a tree in the mahogany family, this is not a good foodsource, but it can be processed to help with infections.';
commonPlantDescriptionsArray[10] = 'Several plants of the genus Trifolium. A common source of nourishment.';
commonPlantDescriptionsArray[11] = 'Vine species of the passion flower. Very nutritious.';
commonPlantDescriptionsArray[12] = 'A citrus fruit the size of an orange. Tastes less sour then lemon, but more bitter than grapefruit.';
commonPlantDescriptionsArray[13] = 'This plant grows 6ft 6in (2m) high. Both the leaves and the roots are edible, and it\'s effective against coughs and colds.';
commonPlantDescriptionsArray[14] = 'This nut is highly nutritious and therefore serves as an excellent source of food.';
commonPlantDescriptionsArray[15] = 'The root of a perennial plant, searched after as a food source and for its ability to help fight fatigue and exhaustion.';


const uncommonPlantNamesArray = ['solomon\'s seal', 'gotu kola', 'great mullein', 'purple coneflower', 'field horsetail', 'bay laurel', 'chick weed', 'yerba mate'];
const uncommonPlantEdibalityArray = ['e', 'e', 'e', 'e', 't', 'e', 'e', 'e'];
const uncommonPlantHealsWoundsArray = [false, true, false, true, true, true, false, true];
const uncommonPlantHealsInfectionsArray = [false, false, false, true, true, true, true, true];
const uncommonPlantHealsColdsArray = [false, false, true, true, false, false, false, false];
const uncommonPlantHealsPoisonArray = [false, false, false, false, false, false, false, false];
const uncommonPlantHealsStrainsArray = [true, true, true, false, false, false, false, false];

const uncommonPlantGivesEnergyArray = [false, true, false, false, false, false, false, true];

const uncommonPlantDescriptionsArray = [];

uncommonPlantDescriptionsArray[0] = 'This flowering plant is a great source of food, but also excellent for healing strains!';
uncommonPlantDescriptionsArray[1] = 'A vegetable often used to treat wounds and strains, as well as being very energizing!';
uncommonPlantDescriptionsArray[2] = 'The great mullein is a high growing biennal plant not only used for consumption but also for colds and strains.';
uncommonPlantDescriptionsArray[3] = 'This flower is not only part of the sunflower family, but also a treatment against wounds, infections, colds, and hunger!';
uncommonPlantDescriptionsArray[4] = 'A perenniel plant that is useful against wounds and infections, but toxic if consumed.';
uncommonPlantDescriptionsArray[5] = 'An aromatic large shrub used to treat wounds and infections!';
uncommonPlantDescriptionsArray[6] = 'The chick weed is not only very tasty, but also able to heal infections.';
uncommonPlantDescriptionsArray[7] = 'This plants leaves are useful for healing wounds and infections, but also energizing due to it containing caffeine.';


const rarePlantNamesArray = ['ribwort plantain', 'charcoal-tree leaves', 'marsh mallow'];
const rarePlantEdibalityArray = ['e', 'e', 'e'];
const rarePlantHealsWoundsArray = [false, false, true];
const rarePlantHealsInfectionsArray = [true, true, true];
const rarePlantHealsColdsArray = [true, true, true];
const rarePlantHealsPoisonArray = [true, true, false];
const rarePlantHealsStrainsArray = [false, false, true];

const rarePlantGivesEnergyArray = [false, false, false];

const rarePlantDescriptionsArray = [];

rarePlantDescriptionsArray[0] = 'A weed for treating infections, colds and poison! Highly nutritious.';
rarePlantDescriptionsArray[1] = 'These leaves do wonders against poison, infections and colds, as well as being very tasty.';
rarePlantDescriptionsArray[2] = 'This sweet tasting plant is very effective against colds, wounds, strains and infections!';

module.exports = {

	commonPlantNamesArray: commonPlantNamesArray,
	commonPlantEdibalityArray: commonPlantEdibalityArray,
	commonPlantHealsWoundsArray: commonPlantHealsWoundsArray,
	commonPlantHealsInfectionsArray: commonPlantHealsInfectionsArray,
	commonPlantHealsColdsArray: commonPlantHealsColdsArray,
	commonPlantHealsPoisonArray: commonPlantHealsPoisonArray,
	commonPlantHealsStrainsArray: commonPlantHealsStrainsArray,
	commonPlantGivesEnergyArray: commonPlantGivesEnergyArray,
	commonPlantDescriptionsArray: commonPlantDescriptionsArray,

	uncommonPlantNamesArray: uncommonPlantNamesArray,
	uncommonPlantEdibalityArray: uncommonPlantEdibalityArray,
	uncommonPlantHealsWoundsArray: uncommonPlantHealsWoundsArray,
	uncommonPlantHealsInfectionsArray: uncommonPlantHealsInfectionsArray,
	uncommonPlantHealsColdsArray: uncommonPlantHealsColdsArray,
	uncommonPlantHealsPoisonArray: uncommonPlantHealsPoisonArray,
	uncommonPlantHealsStrainsArray: uncommonPlantHealsStrainsArray,
	uncommonPlantGivesEnergyArray: uncommonPlantGivesEnergyArray,
	uncommonPlantDescriptionsArray: uncommonPlantDescriptionsArray,

	rarePlantNamesArray: rarePlantNamesArray,
	rarePlantEdibalityArray: rarePlantEdibalityArray,
	rarePlantHealsWoundsArray: rarePlantHealsWoundsArray,
	rarePlantHealsInfectionsArray: rarePlantHealsInfectionsArray,
	rarePlantHealsColdsArray: rarePlantHealsColdsArray,
	rarePlantHealsPoisonArray: rarePlantHealsPoisonArray,
	rarePlantHealsStrainsArray: rarePlantHealsStrainsArray,
	rarePlantGivesEnergyArray: rarePlantGivesEnergyArray,
	rarePlantDescriptionsArray: rarePlantDescriptionsArray,

	species(profileData) {

		const nameArray = [];
		const dietArray = [];
		const habitatArray = [];
		let biome1OpponentsArray = [];
		let biome2OpponentsArray = [];
		let biome3OpponentsArray = [];

		nameArray[0] = 'wolf';
		dietArray[0] = 'carnivore';
		habitatArray[0] = 'cold';
		if (profileData && profileData.species == nameArray[0]) {
			biome1OpponentsArray = ['rabbit', 'squirrel', 'deer'];
			biome2OpponentsArray = ['fox', 'dog'];
			biome3OpponentsArray = ['bear', 'horse', 'elk'];
		}

		nameArray[1] = 'cat';
		dietArray[1] = 'carnivore';
		habitatArray[1] = 'cold';
		if (profileData && profileData.species == nameArray[1]) {
			biome1OpponentsArray = ['rabbit', 'squirrel', 'owl'];
			biome2OpponentsArray = ['fox', 'bear'];
			biome3OpponentsArray = ['wolf', 'dog'];
		}

		nameArray[2] = 'fox';
		dietArray[2] = 'omnivore';
		habitatArray[2] = 'cold';
		if (profileData && profileData.species == nameArray[2]) {
			biome1OpponentsArray = ['rabbit', 'squirrel', 'owl'];
			biome2OpponentsArray = ['cat', 'dog', 'deer'];
			biome3OpponentsArray = ['wolf', 'bear'];
		}

		nameArray[3] = 'leopard';
		dietArray[3] = 'carnivore';
		habitatArray[3] = 'warm';
		if (profileData && profileData.species == nameArray[3]) {
			biome1OpponentsArray = ['coyote', 'maned wolf'];
			biome2OpponentsArray = ['caracal'];
			biome3OpponentsArray = ['tiger', 'lion'];
		}

		nameArray[4] = 'tiger';
		dietArray[4] = 'carnivore';
		habitatArray[4] = 'warm';
		if (profileData && profileData.species == nameArray[4]) {
			biome1OpponentsArray = ['coyote', 'maned wolf'];
			biome2OpponentsArray = ['leopard', 'caracal'];
			biome3OpponentsArray = ['lion'];
		}

		nameArray[5] = 'shark';
		dietArray[5] = 'carnivore';
		habitatArray[5] = 'water';
		if (profileData && profileData.species == nameArray[5]) {
			biome1OpponentsArray = ['salmon', 'tuna', 'squid'];
			biome2OpponentsArray = ['seal', 'crab'];
			biome3OpponentsArray = ['orca'];
		}

		nameArray[6] = 'caracal';
		dietArray[6] = 'carnivore';
		habitatArray[6] = 'warm';
		if (profileData && profileData.species == nameArray[6]) {
			biome1OpponentsArray = ['coyote', 'maned wolf'];
			biome2OpponentsArray = ['leopard', 'tiger'];
			biome3OpponentsArray = ['lion'];
		}

		nameArray[7] = 'bear';
		dietArray[7] = 'omnivore';
		habitatArray[7] = 'cold';
		if (profileData && profileData.species == nameArray[7]) {
			biome1OpponentsArray = ['rabbit', 'squirrel', 'salmon', 'tuna'];
			biome2OpponentsArray = ['cat', 'fox', 'dog'];
			biome3OpponentsArray = ['wolf', 'horse', 'elk'];
		}

		nameArray[8] = 'coyote';
		dietArray[8] = 'omnivore';
		habitatArray[8] = 'warm';
		if (profileData && profileData.species == nameArray[8]) {
			biome1OpponentsArray = ['caracal', 'maned wolf'];
			biome2OpponentsArray = ['leopard'];
			biome3OpponentsArray = ['tiger', 'lion'];
		}

		nameArray[9] = 'rabbit';
		dietArray[9] = 'herbivore';
		habitatArray[9] = 'cold';
		if (profileData && profileData.species == nameArray[9]) {
			biome1OpponentsArray = ['squirrel', 'owl'];
			biome2OpponentsArray = ['dog', 'deer'];
			biome3OpponentsArray = ['wolf', 'cat', 'bear'];
		}

		nameArray[10] = 'squirrel';
		dietArray[10] = 'omnivore';
		habitatArray[10] = 'cold';
		if (profileData && profileData.species == nameArray[10]) {
			biome1OpponentsArray = ['rabbit', 'owl'];
			biome2OpponentsArray = ['dog', 'deer'];
			biome3OpponentsArray = ['wolf', 'cat', 'bear'];
		}

		nameArray[11] = 'lion';
		dietArray[11] = 'carnivore';
		habitatArray[11] = 'warm';
		if (profileData && profileData.species == nameArray[11]) {
			biome1OpponentsArray = ['coyote', 'maned wolf'];
			biome2OpponentsArray = ['leopard', 'caracal'];
			biome3OpponentsArray = ['tiger'];
		}

		nameArray[12] = 'seal';
		dietArray[12] = 'carnivore';
		habitatArray[12] = 'water';
		if (profileData && profileData.species == nameArray[12]) {
			biome1OpponentsArray = ['salmon', 'tuna', 'squid'];
			biome2OpponentsArray = ['bear', 'crab'];
			biome3OpponentsArray = ['shark', 'orca'];
		}

		nameArray[13] = 'salmon';
		dietArray[13] = 'carnivore';
		habitatArray[13] = 'water';
		if (profileData && profileData.species == nameArray[13]) {
			biome1OpponentsArray = ['squid'];
			biome2OpponentsArray = ['crab'];
			biome3OpponentsArray = ['bear', 'seal', 'owl'];
		}

		nameArray[14] = 'tuna';
		dietArray[14] = 'carnivore';
		habitatArray[14] = 'water';
		if (profileData && profileData.species == nameArray[14]) {
			biome1OpponentsArray = ['salmon', 'squid'];
			biome2OpponentsArray = ['crab'];
			biome3OpponentsArray = ['bear', 'seal', 'owl'];
		}

		nameArray[15] = 'squid';
		dietArray[15] = 'carnivore';
		habitatArray[15] = 'water';
		if (profileData && profileData.species == nameArray[15]) {
			biome1OpponentsArray = ['crab'];
			biome2OpponentsArray = ['tuna', 'salmon'];
			biome3OpponentsArray = ['shark', 'seal', 'owl'];
		}

		nameArray[16] = 'crab';
		dietArray[16] = 'omnivore';
		habitatArray[16] = 'water';
		if (profileData && profileData.species == nameArray[16]) {
			biome1OpponentsArray = ['squid'];
			biome2OpponentsArray = ['tuna', 'salmon'];
			biome3OpponentsArray = ['bear', 'seal', 'owl'];
		}

		nameArray[17] = 'orca';
		dietArray[17] = 'carnivore';
		habitatArray[17] = 'water';
		if (profileData && profileData.species == nameArray[17]) {
			biome1OpponentsArray = ['salmon', 'tuna', 'squid'];
			biome2OpponentsArray = ['seal', 'crab'];
			biome3OpponentsArray = ['shark'];
		}

		nameArray[18] = 'maned wolf';
		dietArray[18] = 'omnivore';
		habitatArray[18] = 'warm';
		if (profileData && profileData.species == nameArray[18]) {
			biome1OpponentsArray = ['caracal', 'coyote'];
			biome2OpponentsArray = ['leopard'];
			biome3OpponentsArray = ['tiger', 'lion'];
		}

		nameArray[19] = 'dog';
		dietArray[19] = 'omnivore';
		habitatArray[19] = 'cold';
		if (profileData && profileData.species == nameArray[19]) {
			biome1OpponentsArray = ['rabbit', 'squirrel', 'deer'];
			biome2OpponentsArray = ['wolf', 'fox'];
			biome3OpponentsArray = ['cat', 'bear'];
		}

		nameArray[20] = 'owl';
		dietArray[20] = 'carnivore';
		habitatArray[20] = 'cold';
		if (profileData && profileData.species == nameArray[20]) {
			biome1OpponentsArray = ['rabbit', 'squirrel'];
			biome2OpponentsArray = ['cat', 'fox'];
			biome3OpponentsArray = ['wolf', 'bear'];
		}

		nameArray[21] = 'deer';
		dietArray[21] = 'herbivore';
		habitatArray[21] = 'cold';
		if (profileData && profileData.species == nameArray[21]) {
			biome1OpponentsArray = ['rabbit', 'squirrel'];
			biome2OpponentsArray = ['fox', 'owl'];
			biome3OpponentsArray = ['wolf', 'bear', 'dog'];
		}

		nameArray[22] = 'penguin';
		dietArray[22] = 'carnivore';
		habitatArray[22] = 'cold';
		if (profileData && profileData.species == nameArray[22]) {
			biome1OpponentsArray = ['salmon', 'tuna', 'squid', 'crab'];
			biome2OpponentsArray = ['dog', 'cat', 'fox'];
			biome3OpponentsArray = ['shark', 'seal', 'orca'];
		}

		nameArray[23] = 'gaboon viper';
		dietArray[23] = 'carnivore';
		habitatArray[23] = 'warm';
		if (profileData && profileData.species == nameArray[23]) {
			biome1OpponentsArray = ['cat', 'rabbit', 'owl'];
			biome2OpponentsArray = ['leopard', 'caracal'];
			biome3OpponentsArray = ['lion', 'tiger'];
		}

		nameArray[24] = 'hoatzin';
		dietArray[24] = 'herbivore';
		habitatArray[24] = 'warm';
		if (profileData && profileData.species == nameArray[24]) {
			biome1OpponentsArray = ['squirrel', 'rabbit'];
			biome2OpponentsArray = ['cat', 'weasel'];
			biome3OpponentsArray = ['eagle', 'hawk', 'cassowary'];
		}

		nameArray[25] = 'weasel';
		dietArray[25] = 'carnivore';
		habitatArray[25] = 'warm';
		if (profileData && profileData.species == nameArray[25]) {
			biome1OpponentsArray = ['squirrel', 'rabbit'];
			biome2OpponentsArray = ['cat', 'fox'];
			biome3OpponentsArray = ['owl', 'gaboon viper'];
		}

		nameArray[26] = 'hawk';
		dietArray[26] = 'carnivore';
		habitatArray[26] = 'warm';
		if (profileData && profileData.species == nameArray[26]) {
			biome1OpponentsArray = ['squirrel', 'rabbit'];
			biome2OpponentsArray = ['owl', 'raccoon'];
			biome3OpponentsArray = ['eagle', 'gaboon viper', 'cassowary'];
		}

		nameArray[27] = 'eagle';
		dietArray[27] = 'carnivore';
		habitatArray[27] = 'warm';
		if (profileData && profileData.species == nameArray[27]) {
			biome1OpponentsArray = ['squirrel', 'rabbit'];
			biome2OpponentsArray = ['bear', 'raccoon'];
			biome3OpponentsArray = ['hawk', 'gaboon viper', 'cassowary'];
		}

		nameArray[28] = 'raccoon';
		dietArray[28] = 'omnivore';
		habitatArray[28] = 'warm';
		if (profileData && profileData.species == nameArray[28]) {
			biome1OpponentsArray = ['salmon', 'rabbit'];
			biome2OpponentsArray = ['owl', 'fox', 'cat'];
			biome3OpponentsArray = ['coyote', 'wolf'];
		}

		nameArray[29] = 'horse';
		dietArray[29] = 'herbivore';
		habitatArray[29] = 'cold';
		if (profileData && profileData.species == nameArray[29]) {
			biome1OpponentsArray = ['cat', 'fox'];
			biome2OpponentsArray = ['deer', 'dog'];
			biome3OpponentsArray = ['bear', 'wolf', 'elk'];
		}

		nameArray[30] = 'elk';
		dietArray[30] = 'herbivore';
		habitatArray[30] = 'cold';
		if (profileData && profileData.species == nameArray[30]) {
			biome1OpponentsArray = ['cat', 'fox'];
			biome2OpponentsArray = ['deer', 'dog'];
			biome3OpponentsArray = ['bear', 'wolf', 'horse'];
		}

		nameArray[31] = 'cassowary';
		dietArray[31] = 'omnivore';
		habitatArray[31] = 'warm';
		if (profileData && profileData.species == nameArray[31]) {
			biome1OpponentsArray = ['maned wolf', 'dog'];
			biome2OpponentsArray = ['hoatzin', 'gaboon viper'];
			biome3OpponentsArray = ['hawk', 'eagle'];
		}


		return {
			nameArray: nameArray,
			dietArray: dietArray,
			habitatArray: habitatArray,
			biome1OpponentsArray: biome1OpponentsArray,
			biome2OpponentsArray: biome2OpponentsArray,
			biome3OpponentsArray: biome3OpponentsArray,
		};
	},

};