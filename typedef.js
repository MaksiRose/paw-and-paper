// @ts-check

/**
 * This object holds references to guilds and users that cannot make accounts in their respective Arrays.
 * @typedef {Object} BanList
 * @property {Array<string>} users
 * @property {Array<string>} servers
 */
module.exports.BanList = this.BanList;


/**
 * This object holds references to files that will be deleted, with either a guild ID or a user + guild ID as the key, and an object with the file name and deletion timestamp as variables.
 * @typedef {Object<string, Object<string, {fileName: string, deletionTimestamp: number}>>} DeleteList
 */
module.exports.DeleteList = this.DeleteList;


/**
 * This object holds references to users and when they voted on which websites, with their user ID as the key, and an object with the last recorded and next redeemable vote for the respective websites as variables.
 * @typedef {Object<string, {lastRecordedTopVote: number, nextRedeemableTopVote: number, lastRecordedDiscordsVote: number, nextRedeemableDiscordsVote: number, lastRecordedDblVote: number, nextRedeemableDblVote: number}>} VoteList
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
 * @property {boolean} reminder - Whether the user wants to be reminded to water the sapling.
 * @property {number} lastMessageChannelId - The ID of the last channel the sapling was watered in.
 */

/**
 * @typedef {Object} Role
 * @property {string} roleId - ID of the role.
 * @property {'rank'|'levels'|'experience'} wayOfEarning - The kind of requirement to meet to earn the role.
 * @property {('Youngling'|'Apprentice'|'Hunter'|'Healer'|'Elderly')|number} requirement - The requirement to meet to earn the role.
 */

/**
 * @typedef {Object} ProfileSchema
 * @property {string} userId - ID of the user that created the account. Cannot be modified.
 * @property {string} serverId - ID of the server that the account was created on. Cannot be modified.
 * @property {string} name - Name of character.
 * @property {string} description - Description of the character.
 * @property {string} color - Embed color used in messages.
 * @property {string} species - Species of the character.
 * @property {'Youngling'|'Apprentice'|'Hunter'|'Healer'|'Elderly'} rank - Rank of the character.
 * @property {string} avatarURL - Avatar URL of the character.
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
 * @property {Sapling} saplingObject - The sapling of the character
 * @property {Array<Array<string>>} pronounSets - Array of Arrays of pronouns the character uses.
 * @property {{wounds: number, infections: number, cold: boolean, sprains: number, poison: boolean}} injuryObject - Object with injury types as keys and whether the user has them/how many the user has of them as variables.
 * @property {{commonPlants: Object, uncommonPlants: Object, rarePlants: Object, meat: Object}} inventoryObject - Object with item kinds as the keys and an object of the item types and their quantity as the variables.
 * @property {{resting: boolean, drinking: boolean, eating: boolean, passingout: boolean}} advice - Object of advice kinds as the keys and whether the advice has been given as the variables.
 * @property {Array<Role>} roles - Array of role objects
 */
module.exports.ProfileSchema = this.ProfileSchema;