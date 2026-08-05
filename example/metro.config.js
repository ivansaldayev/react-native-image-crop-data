const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");
const libraryPkg = require("../package.json");

const exampleRoot = __dirname;
const libraryRoot = path.resolve(__dirname, "..");
const exampleNodeModules = path.join(exampleRoot, "node_modules");

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// R5: the library is consumed here as a real dependency, resolved through
// `example/node_modules/react-native-image-crop-data`, which npm links as a symlink to
// `libraryRoot` (`file:..`) rather than copying files. `libraryRoot` has its own
// `node_modules`, installed for the library's own build/test tooling, which happens to
// contain a second copy of every one of the library's peer dependencies (react, react-native,
// react-native-gesture-handler, react-native-reanimated). Left unconfigured, Metro would
// bundle both copies -- the classic "two copies of React" / "two copies of reanimated"
// failure, which shows up as confusing runtime errors (e.g. invalid hook calls, worklets
// silently not registering), not build errors.
const peerDependencyNames = Object.keys(libraryPkg.peerDependencies ?? {});

const config = getDefaultConfig(exampleRoot);

// Lets Metro see (and watch) the library's source through the symlink at all.
config.watchFolders = [...(config.watchFolders ?? []), libraryRoot];

// The example's own `node_modules` is searched first -- ahead of whatever Metro would
// otherwise find walking up the directory tree from a file reached through the
// `libraryRoot` symlink.
config.resolver.nodeModulesPaths = [exampleNodeModules, ...(config.resolver.nodeModulesPaths ?? [])];

// Any resolution reaching into the library's own nested copy of a peer dependency is
// refused outright...
config.resolver.blockList = [
  ...[config.resolver.blockList].flat().filter(Boolean),
  ...peerDependencyNames.map(
    (name) => new RegExp(`^${escapeRegExp(path.join(libraryRoot, "node_modules", name))}[\\/].*$`),
  ),
];

// ...and redirected back to the example's own single copy instead.
config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  ...peerDependencyNames.reduce((acc, name) => {
    acc[name] = path.join(exampleNodeModules, name);
    return acc;
  }, {}),
};

module.exports = config;
