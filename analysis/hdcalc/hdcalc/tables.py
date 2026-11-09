"""Static Human Design / Gene Keys lookup tables. No logic here."""

# Order of gates around the zodiac wheel, starting at 302.0 deg (2 deg Aquarius).
GATE_ORDER = [
    41, 19, 13, 49, 30, 55, 37, 63, 22, 36, 25, 17, 21, 51, 42, 3,
    27, 24, 2, 23, 8, 20, 16, 35, 45, 12, 15, 52, 39, 53, 62, 56,
    31, 33, 7, 4, 29, 59, 40, 64, 47, 6, 46, 18, 48, 57, 32, 50,
    28, 44, 1, 43, 14, 34, 9, 5, 26, 11, 10, 58, 38, 54, 61, 60,
]
WHEEL_START = 302.0
GATE_ARC = 360.0 / 64          # 5.625
LINE_ARC = GATE_ARC / 6        # 0.9375

CENTERS = {
    "Head": [64, 61, 63],
    "Ajna": [47, 24, 4, 17, 43, 11],
    "Throat": [62, 23, 56, 35, 12, 45, 33, 8, 31, 20, 16],
    "G": [1, 13, 25, 46, 2, 15, 10, 7],
    "Heart": [21, 40, 26, 51],
    "Sacral": [34, 5, 14, 29, 59, 9, 3, 42, 27],
    "Spleen": [48, 57, 44, 50, 32, 28, 18],
    "Solar Plexus": [6, 37, 22, 36, 30, 55, 49],
    "Root": [53, 60, 52, 19, 39, 41, 58, 38, 54],
}
GATE_CENTER = {g: c for c, gs in CENTERS.items() for g in gs}
MOTORS = {"Sacral", "Heart", "Solar Plexus", "Root"}

CENTER_KEYNOTES = {
    "Head": "Inspiration; pressure to think and to answer questions",
    "Ajna": "Conceptualization; mental awareness, how we process and hold ideas",
    "Throat": "Communication and manifestation; speaking and doing",
    "G": "Identity, direction and love; the magnetic monopole",
    "Heart": "Willpower, ego, value, material world and commitments",
    "Sacral": "Life force, sexuality, work and response (the generator engine)",
    "Spleen": "Intuition, survival instinct, health, timing, fear and well-being",
    "Solar Plexus": "Emotions, feelings, desire and nervousness; the emotional wave",
    "Root": "Adrenal pressure and stress; the fuel to get things going",
}

CHANNELS = {
    (1, 8): "Inspiration", (2, 14): "The Beat", (3, 60): "Mutation",
    (4, 63): "Logic", (5, 15): "Rhythm", (6, 59): "Mating (Intimacy)",
    (7, 31): "The Alpha", (9, 52): "Concentration", (10, 20): "Awakening",
    (10, 34): "Exploration", (10, 57): "Perfected Form", (11, 56): "Curiosity",
    (12, 22): "Openness", (13, 33): "The Prodigal", (16, 48): "The Wavelength",
    (17, 62): "Acceptance", (18, 58): "Judgment", (19, 49): "Synthesis",
    (20, 34): "Charisma", (20, 57): "The Brainwave", (21, 45): "Money Line",
    (23, 43): "Structuring", (24, 61): "Awareness", (25, 51): "Initiation",
    (26, 44): "Surrender", (27, 50): "Preservation", (28, 38): "Struggle",
    (29, 46): "Discovery", (30, 41): "Recognition", (32, 54): "Transformation",
    (34, 57): "Power", (35, 36): "Transitoriness", (37, 40): "Community",
    (39, 55): "Emoting", (42, 53): "Maturation", (47, 64): "Abstraction",
}

GATE_NAMES = {
    1: "Self-Expression", 2: "Direction of the Self", 3: "Ordering",
    4: "Formulization", 5: "Fixed Rhythms", 6: "Friction", 7: "The Role of the Self",
    8: "Contribution", 9: "Focus", 10: "Behavior of the Self", 11: "Ideas",
    12: "Caution", 13: "The Listener", 14: "Power Skills", 15: "Extremes",
    16: "Skills", 17: "Opinions", 18: "Correction", 19: "Wanting", 20: "The Now",
    21: "The Hunter/Huntress", 22: "Openness", 23: "Assimilation",
    24: "Rationalization", 25: "The Spirit of the Self", 26: "The Egoist",
    27: "Caring", 28: "The Game Player", 29: "Saying Yes",
    30: "Recognition of Feelings", 31: "Leading", 32: "Continuity", 33: "Privacy",
    34: "Power", 35: "Change", 36: "Crisis", 37: "Friendship", 38: "The Fighter",
    39: "The Provocateur", 40: "Aloneness", 41: "Contraction", 42: "Growth",
    43: "Insight", 44: "Alertness", 45: "The Gatherer",
    46: "Determination of the Self", 47: "Realization", 48: "Depth",
    49: "Principles", 50: "Values", 51: "Shock", 52: "Stillness (Inaction)",
    53: "Beginnings", 54: "Ambition (Drive)", 55: "Spirit", 56: "Stimulation",
    57: "Intuitive Insight", 58: "Vitality (Aliveness)", 59: "Sexuality",
    60: "Acceptance", 61: "Mystery", 62: "Details", 63: "Doubt", 64: "Confusion",
}

# Gene Keys: (Shadow, Gift, Siddhi) per Richard Rudd's published spectrum.
GENE_KEYS = {
    1: ("Entropy", "Freshness", "Beauty"), 2: ("Dislocation", "Orientation", "Unity"),
    3: ("Chaos", "Innovation", "Innocence"), 4: ("Intolerance", "Understanding", "Forgiveness"),
    5: ("Impatience", "Patience", "Timelessness"), 6: ("Conflict", "Diplomacy", "Peace"),
    7: ("Division", "Guidance", "Virtue"), 8: ("Mediocrity", "Style", "Exquisiteness"),
    9: ("Inertia", "Determination", "Invincibility"), 10: ("Self-Obsession", "Naturalness", "Being"),
    11: ("Obscurity", "Idealism", "Light"), 12: ("Vanity", "Discrimination", "Purity"),
    13: ("Discord", "Discernment", "Empathy"), 14: ("Compromise", "Competence", "Bounteousness"),
    15: ("Dullness", "Magnetism", "Florescence"), 16: ("Indifference", "Versatility", "Mastery"),
    17: ("Opinion", "Far-Sightedness", "Omniscience"), 18: ("Judgment", "Integrity", "Perfection"),
    19: ("Co-Dependence", "Sensitivity", "Sacrifice"), 20: ("Superficiality", "Self-Assurance", "Presence"),
    21: ("Control", "Authority", "Valour"), 22: ("Dishonour", "Graciousness", "Grace"),
    23: ("Complexity", "Simplicity", "Quintessence"), 24: ("Addiction", "Invention", "Silence"),
    25: ("Constriction", "Acceptance", "Universal Love"), 26: ("Pride", "Artfulness", "Invisibility"),
    27: ("Selfishness", "Altruism", "Selflessness"), 28: ("Purposelessness", "Totality", "Immortality"),
    29: ("Half-Heartedness", "Commitment", "Devotion"), 30: ("Desire", "Lightness", "Rapture"),
    31: ("Arrogance", "Leadership", "Humility"), 32: ("Failure", "Preservation", "Veneration"),
    33: ("Forgetting", "Mindfulness", "Revelation"), 34: ("Force", "Strength", "Majesty"),
    35: ("Hunger", "Adventure", "Boundlessness"), 36: ("Turbulence", "Humanity", "Compassion"),
    37: ("Weakness", "Equality", "Tenderness"), 38: ("Struggle", "Perseverance", "Honour"),
    39: ("Provocation", "Dynamism", "Liberation"), 40: ("Exhaustion", "Resolve", "Divine Will"),
    41: ("Fantasy", "Anticipation", "Emanation"), 42: ("Expectation", "Detachment", "Celebration"),
    43: ("Deafness", "Insight", "Epiphany"), 44: ("Interference", "Teamwork", "Synarchy"),
    45: ("Dominance", "Synergy", "Communion"), 46: ("Seriousness", "Delight", "Ecstasy"),
    47: ("Oppression", "Transmutation", "Transfiguration"), 48: ("Inadequacy", "Resourcefulness", "Wisdom"),
    49: ("Reaction", "Revolution", "Rebirth"), 50: ("Corruption", "Equilibrium", "Harmony"),
    51: ("Agitation", "Initiative", "Awakening"), 52: ("Stress", "Restraint", "Stillness"),
    53: ("Immaturity", "Expansion", "Superabundance"), 54: ("Greed", "Aspiration", "Ascension"),
    55: ("Victimisation", "Freedom", "Freedom"), 56: ("Distraction", "Enrichment", "Intoxication"),
    57: ("Unease", "Intuition", "Clarity"), 58: ("Dissatisfaction", "Vitality", "Bliss"),
    59: ("Dishonesty", "Intimacy", "Transparency"), 60: ("Limitation", "Realism", "Justice"),
    61: ("Psychosis", "Inspiration", "Sanctity"), 62: ("Intellect", "Precision", "Impeccability"),
    63: ("Doubt", "Inquiry", "Truth"), 64: ("Confusion", "Imagination", "Illumination"),
}

# Gene Keys sphere -> (side, planet). Source: genekeys.com/resource/astrology/
GENE_KEY_SPHERES = {
    "activation_sequence": [
        ("Life's Work", "personality", "Sun"), ("Evolution", "personality", "Earth"),
        ("Radiance", "design", "Sun"), ("Purpose", "design", "Earth"),
    ],
    "venus_sequence": [
        ("Attraction", "design", "Moon"), ("IQ", "personality", "Venus"),
        ("EQ", "personality", "Mars"), ("SQ", "design", "Venus"),
        ("Core Wound", "design", "Mars"),
    ],
    "pearl_sequence": [
        ("Vocation", "design", "Mars"), ("Culture", "design", "Jupiter"),
        ("Brand", "personality", "Sun"), ("Pearl", "personality", "Jupiter"),
    ],
}

PROFILES = {
    "1/3": "Investigator / Martyr", "1/4": "Investigator / Opportunist",
    "2/4": "Hermit / Opportunist", "2/5": "Hermit / Heretic",
    "3/5": "Martyr / Heretic", "3/6": "Martyr / Role Model",
    "4/6": "Opportunist / Role Model", "4/1": "Opportunist / Investigator",
    "5/1": "Heretic / Investigator", "5/2": "Heretic / Hermit",
    "6/2": "Role Model / Hermit", "6/3": "Role Model / Martyr",
}
RIGHT_ANGLE_PROFILES = {"1/3", "1/4", "2/4", "2/5", "3/5", "3/6", "4/6"}
JUXTAPOSITION_PROFILES = {"4/1"}

# Right Angle cross names keyed by the four gates of the quartet (personality Sun gate decides).
RIGHT_ANGLE_CROSSES = {
    "the Sphinx": (1, 2, 7, 13), "the Vessel of Love": (25, 46, 10, 15),
    "Eden": (12, 11, 36, 6), "the Four Ways": (24, 44, 19, 33),
    "Penetration": (51, 57, 54, 53), "Laws": (3, 50, 60, 56),
    "Explanation": (4, 49, 23, 43), "Consciousness": (63, 64, 35, 5),
    "Planning": (9, 16, 37, 40), "Service": (17, 18, 58, 52),
    "the Maya": (61, 62, 32, 42), "the Unexpected": (27, 28, 41, 31),
    "Contagion": (30, 29, 14, 8), "Rulership": (45, 26, 22, 47),
    "Tension": (21, 48, 38, 39), "the Sleeping Phoenix": (20, 34, 55, 59),
}
RA_CROSS_BY_SUN_GATE = {g: name for name, gs in RIGHT_ANGLE_CROSSES.items() for g in gs}

TYPE_INFO = {
    "Manifestor": ("To Inform", "Peace", "Anger"),
    "Generator": ("To Respond", "Satisfaction", "Frustration"),
    "Manifesting Generator": ("To Respond (then Inform)", "Satisfaction", "Frustration / Anger"),
    "Projector": ("Wait for the Invitation", "Success", "Bitterness"),
    "Reflector": ("Wait a Lunar Cycle", "Surprise", "Disappointment"),
}
