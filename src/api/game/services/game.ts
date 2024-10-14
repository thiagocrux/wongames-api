/**
 * game service
 */

import axios from "axios";
import { JSDOM } from "jsdom";
import slugify from "slugify";
import { factories } from "@strapi/strapi";

const GAME_SERVICE = "api::game.game";
const PUBLISHER_SERVICE = "api::publisher.publisher";
const DEVELOPER_SERVICE = "api::developer.developer";
const CATEGORY_SERVICE = "api::category.category";
const PLATFORM_SERVICE = "api::platform.platform";

async function getGameInfo(slug) {
  const gogSlug = slug.replaceAll("-", "_").toLowerCase();
  const body = await axios.get(`https://www.gog.com/game/${gogSlug}`);
  const dom = new JSDOM(body.data);
  const rawDescription = dom.window.document.querySelector(".description");
  const description = rawDescription.innerHTML;
  const shortDescription = rawDescription.textContent.slice(0, 160);

  const ratingElement = dom.window.document.querySelector(
    ".age-restrictions__icon use"
  );

  return {
    description,
    shortDescription,
    rating: ratingElement
      ? ratingElement
          .getAttribute("xlink:href")
          .replace(/_/g, "")
          .replace("#", "")
      : "BR0",
  };
}

async function getByName(name, entityService) {
  const item = await strapi.service(entityService).find({
    filters: { name },
  });

  return item.results.length > 0 ? item.results[0] : null;
}

async function create(name, entityService) {
  const item = await getByName(name, entityService);

  if (!item) {
    await strapi.service(entityService).create({
      data: {
        name,
        slug: slugify(name, { strict: true, lower: true }),
      },
    });
  }
}

async function createManyToManyData(products) {
  const developersSet = new Set();
  const publishersSet = new Set();
  const categoriesSet = new Set();
  const platformsSet = new Set();

  products.forEach((product) => {
    const { developers, publishers, genres, operatingSystems } = product;

    developers.forEach((developer) => {
      developersSet.add(developer);
    });

    publishers.forEach((publisher) => {
      publishersSet.add(publisher);
    });

    genres?.forEach(({ name }) => {
      categoriesSet.add(name);
    });

    operatingSystems.forEach((platform) => {
      platformsSet.add(platform);
    });
  });

  const createCall = (set, entityName) =>
    Array.from(set).map((name) => create(name, entityName));

  return Promise.all([
    ...createCall(developersSet, DEVELOPER_SERVICE),
    ...createCall(publishersSet, PUBLISHER_SERVICE),
    ...createCall(categoriesSet, CATEGORY_SERVICE),
    ...createCall(platformsSet, PLATFORM_SERVICE),
  ]);
}

export default factories.createCoreService(GAME_SERVICE, () => ({
  async populate(params) {
    const gogApiUrl = `https://catalog.gog.com/v1/catalog?limit=48&order=desc%3Atrending`;

    const {
      data: { products },
    } = await axios.get(gogApiUrl);

    await createManyToManyData(products);
  },
}));
