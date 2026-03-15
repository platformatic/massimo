/**
 * Create the registry that owns stable schema-path and structural-name assignments for a scan run.
 */
export function createNameRegistry () {
  const namesByPath = new Map()
  const namesByStructure = new Map()
  const countsByBaseName = new Map()

  function getUniqueName ({ baseName }) {
    const currentCount = countsByBaseName.get(baseName) || 0
    countsByBaseName.set(baseName, currentCount + 1)

    if (currentCount === 0) {
      return baseName
    }

    return `${baseName}_${currentCount}`
  }

  return {
    registerPathName ({ path, name }) {
      if (namesByPath.has(path)) {
        return namesByPath.get(path).name
      }

      const uniqueName = getUniqueName({ baseName: name })
      namesByPath.set(path, {
        name: uniqueName,
        baseName: name
      })

      return uniqueName
    },

    getPathName ({ path }) {
      return namesByPath.get(path)?.name
    },

    linkPathName ({ path, name, baseName = name }) {
      namesByPath.set(path, {
        name,
        baseName
      })

      return name
    },

    hasPathName ({ path }) {
      return namesByPath.has(path)
    },

    getPathBaseName ({ path }) {
      return namesByPath.get(path)?.baseName
    },

    getPathEntries () {
      return new Map(Array.from(namesByPath.entries(), ([path, entry]) => [path, entry.name]))
    },

    hasStructureName ({ key }) {
      return namesByStructure.has(key)
    },

    getStructureName ({ key }) {
      return namesByStructure.get(key)
    },

    setStructureName ({ key, name }) {
      namesByStructure.set(key, name)
    }
  }
}
