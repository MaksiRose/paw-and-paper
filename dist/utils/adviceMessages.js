"use strict";
// @ts-check
const profileModel = require('../models/profileModel');
/**
 * Sends advice message to play.
 * @param {import('discord.js').Message} message
 */
async function playAdvice(message) {
    await message.channel
        .send({
        content: `${message.author.toString()} ❓ **Tip:**\nGo playing via \`rp play\` to find quests and rank up!`,
    })
        .catch((error) => {
        if (error.httpStatus !== 404) {
            throw new Error(error);
        }
    });
}
/**
 * Sends advice to rest.
 * @param {import('discord.js').Message<true>} message
 * @param {import('../typedef').ProfileSchema} userData
 */
async function restAdvice(message, userData) {
    const characterData = userData.characters[userData.currentCharacter[message.guild.id]];
    const profileData = characterData.profiles[message.guild.id];
    if (profileData.energy <= 80 && userData.advice.resting === false) {
        await profileModel.findOneAndUpdate({ uuid: userData.uuid }, (/** @type {import('../typedef').ProfileSchema} */ p) => {
            p.advice.resting = true;
        });
        await message.channel
            .send({
            content: `<@${userData.userId}> ❓ **Tip:**\nRest via \`rp rest\` to fill up your energy. Resting takes a while, so be patient!\nYou can also do \`rp vote\` to get +30 energy per vote!`,
        })
            .catch((error) => {
            if (error.httpStatus !== 404) {
                throw new Error(error);
            }
        });
    }
}
/**
 * Sends advice to drink.
 * @param {import('discord.js').Message<true>} message
 * @param {import('../typedef').ProfileSchema} userData
 */
async function drinkAdvice(message, userData) {
    const characterData = userData.characters[userData.currentCharacter[message.guild.id]];
    const profileData = characterData.profiles[message.guild.id];
    if (profileData.thirst <= 80 && userData.advice.drinking === false) {
        await profileModel.findOneAndUpdate({ uuid: userData.uuid }, (/** @type {import('../typedef').ProfileSchema} */ p) => {
            p.advice.drinking = true;
        });
        await message.channel
            .send({
            content: `<@${userData.userId}> ❓ **Tip:**\nDrink via \`rp drink\` to fill up your thirst.`,
        })
            .catch((error) => {
            if (error.httpStatus !== 404) {
                throw new Error(error);
            }
        });
    }
}
/**
 * Sends advice to eat.
 * @param {import('discord.js').Message<true>} message
 * @param {import('../typedef').ProfileSchema} userData
 */
async function eatAdvice(message, userData) {
    const characterData = userData.characters[userData.currentCharacter[message.guild.id]];
    const profileData = characterData.profiles[message.guild.id];
    if (profileData.hunger <= 80 && userData.advice.eating === false) {
        await profileModel.findOneAndUpdate({ uuid: userData.uuid }, (/** @type {import('../typedef').ProfileSchema} */ p) => {
            p.advice.eating = true;
        });
        await message.channel
            .send({
            content: `<@${userData.userId}> ❓ **Tip:**\nEat via \`rp eat\` to fill up your hunger. Carnivores prefer meat, and herbivores prefer plants! Omnivores can eat both.`,
        })
            .catch((error) => {
            if (error.httpStatus !== 404) {
                throw new Error(error);
            }
        });
    }
}
/**
 * Sends advice of what to do when passing out.
 * @param {import('discord.js').Message} message
 * @param {import('../typedef').ProfileSchema} userData
 */
async function passingoutAdvice(message, userData) {
    if (userData.advice.passingout === false) {
        await profileModel.findOneAndUpdate({ uuid: userData.uuid }, (/** @type {import('../typedef').ProfileSchema} */ p) => {
            p.advice.passingout = true;
        });
        await message.channel
            .send({
            content: `${message.author.toString()} ❓ **Tip:**\nIf your health, energy, hunger or thirst points hit zero, you pass out. Another player has to heal you so you can continue playing.\nMake sure to always watch your stats to prevent passing out!`,
        })
            .catch((error) => {
            if (error.httpStatus !== 404) {
                throw new Error(error);
            }
        });
    }
}
/**
 * Sends advice of how the colors work.
 * @param {import('discord.js').Message} message
 * @param {import('../typedef').ProfileSchema} userData
 */
async function coloredButtonsAdvice(message, userData) {
    if (userData.advice.coloredbuttons === false) {
        await profileModel.findOneAndUpdate({ uuid: userData.uuid }, (/** @type {import('../typedef').ProfileSchema} */ p) => {
            p.advice.coloredbuttons = true;
        });
        await message.channel
            .send({
            content: `${message.author.toString()} ❓ **Tip:**\nA red button means that you picked wrong, the blue button is what you should've picked instead. A green button means that you picked correct.`,
        })
            .catch((error) => {
            if (error.httpStatus !== 404) {
                throw new Error(error);
            }
        });
    }
}
/**
 * Sends advice of what changes as Apprentice.
 * @param {import('discord.js').Message} message
 */
async function apprenticeAdvice(message) {
    await message.channel
        .send({
        content: `${message.author.toString()} ❓ **Tip:**\nAs apprentice, you unlock new commands: \`explore\`, \`heal\`, \`practice\`, and \`repair\`.\nCheck \`rp help\` to see what they do!\nGo exploring via \`rp explore\` to find more quests and rank up higher!`,
    })
        .catch((error) => {
        if (error.httpStatus !== 404) {
            throw new Error(error);
        }
    });
}
/**
 * Sends advice of what changes as Hunter/Healer.
 * @param {import('discord.js').Message} message
 */
async function hunterhealerAdvice(message) {
    await message.channel
        .send({
        content: `${message.author.toString()} ❓ **Tip:**\nHunters and Healers have different strengths and weaknesses!\nHealers can \`heal\` perfectly and find more plants when \`exploring\`, but they are not so good at \`repairing\`.\nHunters can \`repair\` perfectly and find more enemies when \`exploring\`, but they are not so good at \`healing\`.\nHunters and Healers don't get advantages from the \`play\` command.`,
    })
        .catch((error) => {
        if (error.httpStatus !== 404) {
            throw new Error(error);
        }
    });
}
/**
 * Sends advice of what changes as Elderly.
 * @param {import('discord.js').Message} message
 */
async function elderlyAdvice(message) {
    await message.channel
        .send({
        content: `${message.author.toString()} ❓ **Tip:**\nElderlies have the abilities of both Hunters and Healers!\nAdditionally, they can use the \`share\` command.`,
    })
        .catch((error) => {
        if (error.httpStatus !== 404) {
            throw new Error(error);
        }
    });
}
module.exports = {
    playAdvice,
    restAdvice,
    drinkAdvice,
    eatAdvice,
    passingoutAdvice,
    coloredButtonsAdvice,
    apprenticeAdvice,
    hunterhealerAdvice,
    elderlyAdvice,
};
