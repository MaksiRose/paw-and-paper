// @ts-check

/**
 * This object holds references to guilds and users that cannot make accounts in their respective Arrays.
 * @typedef {Object} BanList
 * @property {Array<string>} users
 * @property {Array<string>} servers
 */
module.exports.BanList = this.BanList;

/**
 * This object holds references to user accounts that are friends.
 * @typedef {Array<string>} GivenIdList
 */
module.exports.GivenIdList = this.GivenIdList;


/**
 * This object holds references to files that will be deleted, with either a guild ID or a user + guild ID as the key, and an object with the file name and deletion timestamp as variables.
 * @typedef {Object<string, number>} DeleteList
 */
module.exports.DeleteList = this.DeleteList;


/**
 * This object holds references to users and when they voted on which websites, with their user ID as the key, and an object with the last recorded and next redeemable vote for the respective websites as variables.
 * @typedef {Object<string, {lastRecordedTopVote?: number, nextRedeemableTopVote?: number, lastRecordedDiscordsVote?: number, nextRedeemableDiscordsVote?: number, lastRecordedDblVote?: number, nextRedeemableDblVote?: number}>} VoteList
 */
module.exports.VoteList = this.VoteList;


/**
 * This object holds references to webhook messages and who the original author is, with the webhook message ID as the key, and the orginal user ID as the variable.
 * @typedef {Object<string, string>} WebhookMessages
 */
module.exports.WebhookMessages = this.WebhookMessages;


/**
 * @typedef {Object} Sapling
 * @property {boolean} exists - Whether there is a sapling.
 * @property {number} health - The health of the sapling.
 * @property {number} waterCycles - How many times the sapling has been watered.
 * @property {?number} nextWaterTimestamp - Timestamp of the next perfect watering.
 * @property {string} lastMessageChannelId - The ID of the last channel the sapling was watered in.
 */

/**
 * @typedef {Object} Role
 * @property {string} roleId - ID of the role.
 * @property {'rank'|'levels'|'experience'} wayOfEarning - The kind of requirement to meet to earn the role.
 * @property {('Youngling'|'Apprentice'|'Hunter'|'Healer'|'Elderly')|number} requirement - The requirement to meet to earn the role.
 */

/**
 * @typedef {Object} Profile
 * @property {string} serverId - ID of the server that this information is associated with.
 * @property {'Youngling'|'Apprentice'|'Hunter'|'Healer'|'Elderly'} rank - Rank of the character.
 * @property {number} levels - Levels of the character.
 * @property {number} experience - Experience Points of the character.
 * @property {number} health - Health Points of the character.
 * @property {number} energy - Energy Points of the character.
 * @property {number} hunger - Hunger Points of the character.
 * @property {number} thirst - Thirst Points of the character.
 * @property {number} maxHealth - Maximum Health Points of the character.
 * @property {number} maxEnergy - Maximum Energy Points of the character.
 * @property {number} maxHunger - Maximum Hunger Points of the character.
 * @property {number} maxThirst - Maximum Thirst Points of the character.
 * @property {boolean} isResting - Whether the character is resting.
 * @property {boolean} hasCooldown - Whether the character is on a cooldown.
 * @property {boolean} hasQuest - Whether the character has an open quest.
 * @property {'sleeping dens' | 'food den' | 'medicine den' | 'prairie' | 'ruins' | 'lake'} currentRegion - The current region the character is in.
 * @property {number} unlockedRanks - How many ranks the character has unlocked.
 * @property {Sapling} sapling - The sapling of the character
 * @property {{wounds: number, infections: number, cold: boolean, sprains: number, poison: boolean}} injuries - Object with injury types as keys and whether the user has them/how many the user has of them as variables.
 * @property {{commonPlants: Object<string, number>, uncommonPlants: Object<string, number>, rarePlants: Object<string, number>, meat: Object<string, number>}} inventory - Object with item kinds as the keys and an object of the item types and their quantity as the variables.
 * @property {Array<Role>} roles - Array of role objects
 * @property {{global: Object<string, number>, personal: Object<string, number>}} skills - Object of skills, with global and personal skills as key-value pairs.
 */

/**
 * @typedef {Object} Character
 * @property {string} _id - Unique ID of the character.
 * @property {string} name - Name of the character.
 * @property {string} species - Species of the character.
 * @property {string} displayedSpecies - Displayed species of the character.
 * @property {string} description - Description of the character.
 * @property {string} avatarURL - Avatar URL of the character.
 * @property {Array<Array<string>>} pronounSets - Array of Arrays of pronouns the character uses.
 * @property {{startsWith: string, endsWith: string}} proxy - Proxy this character uses.
 * @property {`#${number}`} color - Embed color used in messages.
 * @property {Object<string, Array<number>>} mentions - Object of character_id as key and an array of timestamps of when the mention has been done as the value
 * @property {Object<string, Profile>} profiles - Object of server IDs this character has been used on as the key and the information associated with it as the value.
 */

/**
 * @typedef {Object} ProfileSchema
 * @property {string} userId - ID of the user that created the account. Cannot be modified.
 * @property {{resting: boolean, drinking: boolean, eating: boolean, passingout: boolean, coloredbuttons: boolean}} advice - Object of advice kinds as the key and whether the advice has been given as the value.
 * @property {{water: boolean, resting: boolean}} reminders - Object of reminder kinds as the key and whether the user wants to be reminded/pinged for these occasions as the value.
 * @property {Object<string, Character>} characters - Object of names of characters as the key and the characters this user has created as value.
 * @property {Object<string, string>} currentCharacter - Object of the server IDs as the key and the id of the character that is currently active as the value.
 * @property {Object<string, Array<string>>} autoproxy - Object of the server IDs as the key and an array of channel IDs as the value.
 * @property {string} lastPlayedVersion - Last major version that the user played on.
 * @property {string} uuid
 */
module.exports.ProfileSchema = this.ProfileSchema;


/**
 * @typedef {Object} ServerSchema
 * @property {string} serverId - ID of the server. Cannot be modified.
 * @property {string} name - Name of the server.
 * @property {{commonPlants: Object<string, number>, uncommonPlants: Object<string, number>, rarePlants: Object<string, number>, meat: Object<string, number>}} inventory - Object with item kinds as the keys and an object of the item types and their quantity as the variables.
 * @property {{den: ?('sleeping dens' | 'food den' | 'medicine den'), blockedKind: ?('vines'|'burrow'|'tree trunk'|'boulder')}} blockedEntrance - Object of the blocked entrance with the name of the den and kind of block as the variables. If no entrance is blocked, they are null.
 * @property {number} nextPossibleAttack - Timestamp of the time when the next attack is possible.
 * @property {?string} visitChannelId - ID of the channel that can be visited. If no channel is seleted, this is null.
 * @property {?string} currentlyVisiting - ID of the guild that is currently being visited. If no guild is being visited, this is null.
 * @property {Array<Role>} shop - Array of role objects
 * @property {{auto: Array<string>, all: Array<string>}} proxysetting - Object with the keys "all" and "auto", which hold an array each with channels where proxying isn't allowed.
 * @property {Array<string>} skills - Array of global skills for this server.
 * @property {string} uuid
 */
module.exports.ServerSchema = this.ServerSchema;

/**
 * @typedef {Object} Event
 * @property {string} name - Name of the event.
 * @property {boolean} once - Whether the event should be executed once.
 * @property {Function} execute
 */
module.exports.Event = this.Event;


/**
 * @typedef {Object} PlantMapObject
 * @property {string} name - Name of the plant.
 * @property {string} description - Description of the plant.
 * @property {'e' | 'i' | 't'} edibality - Edibabilty of the plant: `e` for edible, `i` for inedible and `t` for toxic.
 * @property {boolean} healsWounds - Whether the plant heals wounds.
 * @property {boolean} healsInfections - Whether the plant heals infections.
 * @property {boolean} healsColds - Whether the plant heals colds.
 * @property {boolean} healsSprains - Whether the plant heals sprains.
 * @property {boolean} healsPoison - Whether the plant heals poison.
 * @property {boolean} givesEnergy - Whether the plant gives energy.
 */
module.exports.PlantMapObject = this.PlantMapObject;


/**
 * @typedef {Object} SpeciesMapObject
 * @property {string} name - Name of the species.
 * @property {'omnivore' | 'herbivore' | 'carnivore'} diet - Diet of the species.
 * @property {'cold' | 'warm' | 'water'} habitat - Habitat that the species lives in.
 * @property {Array<string>} biome1OpponentArray - Opponents that the species meets in biome 1.
 * @property {Array<string>} biome2OpponentArray - Opponents that the species meets in biome 2.
 * @property {Array<string>} biome3OpponentArray - Opponents that the species meets in biome 2.
 */
module.exports.SpeciesMapObject = this.SpeciesMapObject;