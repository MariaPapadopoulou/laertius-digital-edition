/**
 * OTV (Ontoterminology Vocabulary) core: classes and properties, reproduced
 * verbatim from the TEDI 4.1 reference export supplied by the curator
 * (diogenes_laertius_22_07_26.rdf, lines 999-1428). Do not edit by hand;
 * this block is the shared vocabulary every TEDI export carries inline.
 */
export const OTV_CORE = `<!-- *********************************************** -->
<!-- ONTOTERMINOLOGY VOCABULARY (OTV) vers. 27/07/2025 -->
<!-- http://ontoterminology.com/ -->
<!-- http://www.ontologia.fr/OTB/otv.rdf -->
<!-- 30/07/2025 -->
<!-- *********************************************** -->

<owl:Class rdf:about="http://www.ontologia.fr/OTB/otv#Ontoterminology">
        <rdfs:label>Ontoterminology</rdfs:label>      
        <rdfs:comment>The class of ontoterminologies</rdfs:comment>
        <rdfs:isDefinedBy>http://www.ontologia.fr/OTB/otv.rdf</rdfs:isDefinedBy>
</owl:Class>


<!-- ***********************************************
                     OTV CLASSES
     *********************************************** -->

<!-- Conceptual dimension -->

<!-- CTT concepts are represented as OWL classes
     and as instances of the OTVConcept  class -->

<owl:Class rdf:about="http://www.ontologia.fr/OTB/otv#OTVCore">
        <rdfs:label>OTVCore</rdfs:label>      
        <rdfs:comment>The Generic Concept of OTV Concepts</rdfs:comment>
        <rdfs:isDefinedBy>http://www.ontologia.fr/OTB/otv.rdf</rdfs:isDefinedBy>
</owl:Class>

<owl:Class rdf:about="http://www.ontologia.fr/OTB/otv#Category">
        <rdfs:label>Category</rdfs:label>
        <rdfs:subClassOf rdf:resource="http://www.ontologia.fr/OTB/otv#OTVCore"/>     
        <rdfs:comment>The class of OTV Categories</rdfs:comment>
        <rdfs:comment>Les categories sont des instances de la classe Category. Une categorie est un top concept</rdfs:comment>
        <rdfs:isDefinedBy>http://www.ontologia.fr/OTB/otv.rdf</rdfs:isDefinedBy>
        <owl:disjointWith rdf:resource="http://www.ontologia.fr/OTB/otv#AxisOfAnalysis"/>
        <owl:disjointWith rdf:resource="http://www.ontologia.fr/OTB/otv#Difference"/>
        <owl:disjointWith rdf:resource="http://www.ontologia.fr/OTB/otv#Relation"/>
        <owl:disjointWith rdf:resource="http://www.ontologia.fr/OTB/otv#Attribute"/>
        <owl:disjointWith rdf:resource="http://www.ontologia.fr/OTB/otv#Object"/>
        <owl:disjointWith rdf:resource="http://www.ontologia.fr/OTB/otv#Term"/>
        <owl:disjointWith rdf:resource="http://www.ontologia.fr/OTB/otv#ProperName"/>
</owl:Class>

<owl:Class rdf:about="http://www.ontologia.fr/OTB/otv#Concept">
        <rdfs:label>Concept</rdfs:label>
        <rdfs:subClassOf rdf:resource="http://www.ontologia.fr/OTB/otv#OTVCore"/>     
        <rdfs:comment>The class of OTV Concepts</rdfs:comment>
        <rdfs:comment>Les concepts sont des instances de la classe Concept</rdfs:comment>
        <rdfs:isDefinedBy>http://www.ontologia.fr/OTB/otv.rdf</rdfs:isDefinedBy>
        <owl:disjointWith rdf:resource="http://www.ontologia.fr/OTB/otv#AxisOfAnalysis"/>
        <owl:disjointWith rdf:resource="http://www.ontologia.fr/OTB/otv#Difference"/>
        <owl:disjointWith rdf:resource="http://www.ontologia.fr/OTB/otv#Relation"/>
        <owl:disjointWith rdf:resource="http://www.ontologia.fr/OTB/otv#Attribute"/>
        <owl:disjointWith rdf:resource="http://www.ontologia.fr/OTB/otv#Object"/>
        <owl:disjointWith rdf:resource="http://www.ontologia.fr/OTB/otv#Term"/>
        <owl:disjointWith rdf:resource="http://www.ontologia.fr/OTB/otv#ProperName"/>
</owl:Class>

<owl:Class rdf:about="http://www.ontologia.fr/OTB/otv#AxisOfAnalysis">
        <rdfs:label>AxisOfAnalysis</rdfs:label>
        <rdfs:subClassOf rdf:resource="http://www.ontologia.fr/OTB/otv#OTVCore"/>     
        <rdfs:comment>The class of OTV AxesOfAnalysis</rdfs:comment>
        <rdfs:comment>Les axes d analyse sont des instances de la classe AxesOfAnalysis</rdfs:comment>
        <rdfs:isDefinedBy>http://www.ontologia.fr/OTB/otv.rdf</rdfs:isDefinedBy>
        <owl:disjointWith rdf:resource="http://www.ontologia.fr/OTB/otv#Category"/>
        <owl:disjointWith rdf:resource="http://www.ontologia.fr/OTB/otv#Concept"/>
        <owl:disjointWith rdf:resource="http://www.ontologia.fr/OTB/otv#Difference"/>
        <owl:disjointWith rdf:resource="http://www.ontologia.fr/OTB/otv#Relation"/>
        <owl:disjointWith rdf:resource="http://www.ontologia.fr/OTB/otv#Attribute"/>
        <owl:disjointWith rdf:resource="http://www.ontologia.fr/OTB/otv#Object"/>
        <owl:disjointWith rdf:resource="http://www.ontologia.fr/OTB/otv#Term"/>
        <owl:disjointWith rdf:resource="http://www.ontologia.fr/OTB/otv#ProperName"/>
</owl:Class>

<owl:Class rdf:about="http://www.ontologia.fr/OTB/otv#Difference">
        <rdfs:label>Difference</rdfs:label>
        <rdfs:subClassOf rdf:resource="http://www.ontologia.fr/OTB/otv#OTVCore"/>    
        <rdfs:comment>The class of OTV Differences</rdfs:comment>
        <rdfs:comment>Les différence sont des instances de la classe Difference</rdfs:comment>
        <rdfs:isDefinedBy>http://www.ontologia.fr/OTB/otv.rdf</rdfs:isDefinedBy>
        <owl:disjointWith rdf:resource="http://www.ontologia.fr/OTB/otv#Category"/>
        <owl:disjointWith rdf:resource="http://www.ontologia.fr/OTB/otv#AxisOfAnalysis"/>
        <owl:disjointWith rdf:resource="http://www.ontologia.fr/OTB/otv#Concept"/>
        <owl:disjointWith rdf:resource="http://www.ontologia.fr/OTB/otv#Relation"/>
        <owl:disjointWith rdf:resource="http://www.ontologia.fr/OTB/otv#Attribute"/>
        <owl:disjointWith rdf:resource="http://www.ontologia.fr/OTB/otv#Object"/>
        <owl:disjointWith rdf:resource="http://www.ontologia.fr/OTB/otv#Term"/>
        <owl:disjointWith rdf:resource="http://www.ontologia.fr/OTB/otv#ProperName"/>
</owl:Class>

<owl:Class rdf:about="http://www.ontologia.fr/OTB/otv#Relation">
        <rdfs:label>Relation</rdfs:label>
        <rdfs:subClassOf rdf:resource="http://www.ontologia.fr/OTB/otv#OTVCore"/>    
        <rdfs:comment>The class of OTV Relations</rdfs:comment>
        <rdfs:isDefinedBy>http://www.ontologia.fr/OTB/otv.rdf</rdfs:isDefinedBy>
        <owl:disjointWith rdf:resource="http://www.ontologia.fr/OTB/otv#Category"/>
        <owl:disjointWith rdf:resource="http://www.ontologia.fr/OTB/otv#AxisOfAnalysis"/>
        <owl:disjointWith rdf:resource="http://www.ontologia.fr/OTB/otv#Difference"/>
        <owl:disjointWith rdf:resource="http://www.ontologia.fr/OTB/otv#Concept"/>
        <owl:disjointWith rdf:resource="http://www.ontologia.fr/OTB/otv#Attribute"/>
        <owl:disjointWith rdf:resource="http://www.ontologia.fr/OTB/otv#Object"/>
        <owl:disjointWith rdf:resource="http://www.ontologia.fr/OTB/otv#Term"/>
        <owl:disjointWith rdf:resource="http://www.ontologia.fr/OTB/otv#ProperName"/>
</owl:Class>

<owl:Class rdf:about="http://www.ontologia.fr/OTB/otv#Attribute">
        <rdfs:label>Attribute</rdfs:label>
        <rdfs:subClassOf rdf:resource="http://www.ontologia.fr/OTB/otv#OTVCore"/>    
        <rdfs:comment>The class of OTV Attributes</rdfs:comment>
        <rdfs:isDefinedBy>http://www.ontologia.fr/OTB/otv.rdf</rdfs:isDefinedBy>
        <owl:disjointWith rdf:resource="http://www.ontologia.fr/OTB/otv#Category"/>
        <owl:disjointWith rdf:resource="http://www.ontologia.fr/OTB/otv#AxisOfAnalysis"/>
        <owl:disjointWith rdf:resource="http://www.ontologia.fr/OTB/otv#Difference"/>
        <owl:disjointWith rdf:resource="http://www.ontologia.fr/OTB/otv#Relation"/>
        <owl:disjointWith rdf:resource="http://www.ontologia.fr/OTB/otv#Concept"/>
        <owl:disjointWith rdf:resource="http://www.ontologia.fr/OTB/otv#Object"/>
        <owl:disjointWith rdf:resource="http://www.ontologia.fr/OTB/otv#Term"/>
        <owl:disjointWith rdf:resource="http://www.ontologia.fr/OTB/otv#ProperName"/>
</owl:Class>

<owl:Class rdf:about="http://www.ontologia.fr/OTB/otv#Object">
        <rdfs:label>Object</rdfs:label>
        <rdfs:subClassOf rdf:resource="http://www.ontologia.fr/OTB/otv#OTVCore"/>
        <rdfs:comment>The class of OTV Objects</rdfs:comment>
        <rdfs:isDefinedBy>http://www.ontologia.fr/OTB/otv.rdf</rdfs:isDefinedBy>
        <owl:disjointWith rdf:resource="http://www.ontologia.fr/OTB/otv#Category"/>
        <owl:disjointWith rdf:resource="http://www.ontologia.fr/OTB/otv#AxisOfAnalysis"/>
        <owl:disjointWith rdf:resource="http://www.ontologia.fr/OTB/otv#Difference"/>
        <owl:disjointWith rdf:resource="http://www.ontologia.fr/OTB/otv#Relation"/>
        <owl:disjointWith rdf:resource="http://www.ontologia.fr/OTB/otv#Attribute"/>
        <owl:disjointWith rdf:resource="http://www.ontologia.fr/OTB/otv#Concept"/>
        <owl:disjointWith rdf:resource="http://www.ontologia.fr/OTB/otv#Term"/>
        <owl:disjointWith rdf:resource="http://www.ontologia.fr/OTB/otv#ProperName"/>
</owl:Class>

<!-- Linguistic dimension -->

<owl:Class rdf:about="http://www.ontologia.fr/OTB/otv#Term">
 	      <rdfs:label>Term</rdfs:label>
        <rdfs:subClassOf rdf:resource="http://www.ontologia.fr/OTB/otv#OTVCore"/>
        <rdfs:comment>The class of OTV Terms</rdfs:comment>
        <rdfs:isDefinedBy>http://www.ontologia.fr/OTB/otv.rdf</rdfs:isDefinedBy>
        <owl:disjointWith rdf:resource="http://www.ontologia.fr/OTB/otv#Category"/>
        <owl:disjointWith rdf:resource="http://www.ontologia.fr/OTB/otv#AxisOfAnalysis"/>
        <owl:disjointWith rdf:resource="http://www.ontologia.fr/OTB/otv#Difference"/>
        <owl:disjointWith rdf:resource="http://www.ontologia.fr/OTB/otv#Relation"/>
        <owl:disjointWith rdf:resource="http://www.ontologia.fr/OTB/otv#Attribute"/>
        <owl:disjointWith rdf:resource="http://www.ontologia.fr/OTB/otv#Object"/>
        <owl:disjointWith rdf:resource="http://www.ontologia.fr/OTB/otv#Concept"/>
        <owl:disjointWith rdf:resource="http://www.ontologia.fr/OTB/otv#ProperName"/>
</owl:Class>

<owl:Class rdf:about="http://www.ontologia.fr/OTB/otv#ProperName">
        <rdfs:label>ProperName</rdfs:label>
        <rdfs:subClassOf rdf:resource="http://www.ontologia.fr/OTB/otv#OTVCore"/>
        <rdfs:comment>The class of OTV ProperName</rdfs:comment>
        <rdfs:isDefinedBy>http://www.ontologia.fr/OTB/otv.rdf</rdfs:isDefinedBy>
        <owl:disjointWith rdf:resource="http://www.ontologia.fr/OTB/otv#Category"/>
        <owl:disjointWith rdf:resource="http://www.ontologia.fr/OTB/otv#AxisOfAnalysis"/>
        <owl:disjointWith rdf:resource="http://www.ontologia.fr/OTB/otv#Difference"/>
        <owl:disjointWith rdf:resource="http://www.ontologia.fr/OTB/otv#Relation"/>
        <owl:disjointWith rdf:resource="http://www.ontologia.fr/OTB/otv#Attribute"/>
        <owl:disjointWith rdf:resource="http://www.ontologia.fr/OTB/otv#Object"/>
        <owl:disjointWith rdf:resource="http://www.ontologia.fr/OTB/otv#Term"/>
        <owl:disjointWith rdf:resource="http://www.ontologia.fr/OTB/otv#Concept"/>
</owl:Class>

<!-- ***********************************************
                     OTV OBJECT PROPERTIES
     *********************************************** -->

<!-- Conceptual dimension -->

<owl:ObjectProperty rdf:about="http://www.ontologia.fr/OTB/otv#isA">
    <rdfs:label>isA</rdfs:label> 
    <rdfs:comment>Generic relationship between 2 concepts</rdfs:comment>
    <rdfs:domain rdf:resource="http://www.ontologia.fr/OTB/otv#Concept"/>
    <rdfs:range rdf:resource="http://www.ontologia.fr/OTB/otv#Concept"/>
    <rdfs:isDefinedBy>http://www.ontologia.fr/OTB/otv.rdf</rdfs:isDefinedBy>
</owl:ObjectProperty>

<owl:ObjectProperty rdf:about="http://www.ontologia.fr/OTB/otv#ownDifference">
  <rdfs:label>ownDifference</rdfs:label>
  <rdfs:comment>Link a concept to one of its specific differences</rdfs:comment>
    <rdfs:domain rdf:resource="http://www.ontologia.fr/OTB/otv#Concept"/>
    <rdfs:range rdf:resource="http://www.ontologia.fr/OTB/otv#Difference"/>
</owl:ObjectProperty>

<owl:ObjectProperty rdf:about="http://www.ontologia.fr/OTB/otv#inheritedDifference">
  <rdfs:label>inheritedDifference</rdfs:label>
  <rdfs:comment>Link a concept to one of its inherited differences</rdfs:comment>
    <rdfs:domain rdf:resource="http://www.ontologia.fr/OTB/otv#Concept"/>
    <rdfs:range rdf:resource="http://www.ontologia.fr/OTB/otv#Difference"/>
</owl:ObjectProperty>

<owl:ObjectProperty rdf:about="http://www.ontologia.fr/OTB/otv#difference">
  <rdfs:label>difference</rdfs:label>
  <rdfs:comment>Link a concept to one of its differences either inherited or specific</rdfs:comment>
    <rdfs:domain rdf:resource="http://www.ontologia.fr/OTB/otv#Concept"/>
    <rdfs:range rdf:resource="http://www.ontologia.fr/OTB/otv#Difference"/>
</owl:ObjectProperty>

<owl:ObjectProperty rdf:about="http://www.ontologia.fr/OTB/otv#belongsToAxis">
  <rdfs:label>belongsToAxis</rdfs:label>
  <rdfs:comment>Indicate the axis of analysis to which the difference belongs</rdfs:comment>
    <rdfs:domain rdf:resource="http://www.ontologia.fr/OTB/otv#Difference"/>
    <rdfs:range rdf:resource="http://www.ontologia.fr/OTB/otv#AxisOfAnalysis"/>
</owl:ObjectProperty>

<owl:ObjectProperty rdf:about="http://www.ontologia.fr/OTB/otv#containsDifference">
  <rdfs:label>containsDifference</rdfs:label>
  <rdfs:comment>Indicate the differences which belongs to the axis of analysis</rdfs:comment>
    <rdfs:domain rdf:resource="http://www.ontologia.fr/OTB/otv#AxisOfAnalysis"/>
    <rdfs:range rdf:resource="http://www.ontologia.fr/OTB/otv#Difference"/>
</owl:ObjectProperty>

<owl:ObjectProperty rdf:about="http://www.ontologia.fr/OTB/otv#attribute">
  <rdfs:label>attribute</rdfs:label>
  <rdfs:comment>Link a concept to one of its attributes either inherited or specific</rdfs:comment>
    <rdfs:domain rdf:resource="http://www.ontologia.fr/OTB/otv#Concept"/>
    <rdfs:range rdf:resource="http://www.ontologia.fr/OTB/otv#Attribute"/>
</owl:ObjectProperty>

<owl:ObjectProperty rdf:about="http://www.ontologia.fr/OTB/otv#instanceOf">
    <rdfs:label>instanceOf</rdfs:label> 
    <rdfs:comment>instance relationship</rdfs:comment>
    <rdfs:domain rdf:resource="http://www.ontologia.fr/OTB/otv#Object"/>
    <rdfs:range rdf:resource="http://www.ontologia.fr/OTB/otv#Concept"/>
    <rdfs:isDefinedBy>http://www.ontologia.fr/OTB/otv.rdf</rdfs:isDefinedBy>
</owl:ObjectProperty>

<owl:ObjectProperty rdf:about="http://www.ontologia.fr/OTB/otv#memberOfCategory">
    <rdfs:label>memberOfCategory</rdfs:label> 
    <rdfs:comment>member of relationship</rdfs:comment>
    <rdfs:domain rdf:resource="http://www.ontologia.fr/OTB/otv#Object"/>
    <rdfs:range rdf:resource="http://www.ontologia.fr/OTB/otv#Category"/>
    <rdfs:isDefinedBy>http://www.ontologia.fr/OTB/otv.rdf</rdfs:isDefinedBy>
</owl:ObjectProperty>

<!-- Linguistic dimension -->

<owl:ObjectProperty rdf:about="http://www.ontologia.fr/OTB/otv#hypernym">
    <rdfs:label>hypernym</rdfs:label> 
    <rdfs:comment>Generic relationship between 2 terms</rdfs:comment>
    <rdfs:domain rdf:resource="http://www.ontologia.fr/OTB/otv#Term"/>
    <rdfs:range rdf:resource="http://www.ontologia.fr/OTB/otv#Term"/>
    <rdfs:isDefinedBy>http://www.ontologia.fr/OTB/otv.rdf</rdfs:isDefinedBy>
</owl:ObjectProperty>

<owl:ObjectProperty rdf:about="http://www.ontologia.fr/OTB/otv#synonym">
    <rdfs:label>synonym</rdfs:label> 
    <rdfs:comment>Synonymy relationship between 2 terms</rdfs:comment>
    <rdfs:domain rdf:resource="http://www.ontologia.fr/OTB/otv#Term"/>
    <rdfs:range rdf:resource="http://www.ontologia.fr/OTB/otv#Term"/>
    <rdfs:isDefinedBy>http://www.ontologia.fr/OTB/otv.rdf</rdfs:isDefinedBy>
</owl:ObjectProperty>

<owl:ObjectProperty rdf:about="http://www.ontologia.fr/OTB/otv#equivalentTerm">
    <rdfs:label>equivalentTerm</rdfs:label> 
    <rdfs:comment>Equivalence relationship between 2 terms</rdfs:comment>
    <rdfs:domain rdf:resource="http://www.ontologia.fr/OTB/otv#Term"/>
    <rdfs:range rdf:resource="http://www.ontologia.fr/OTB/otv#Term"/>
    <rdfs:isDefinedBy>http://www.ontologia.fr/OTB/otv.rdf</rdfs:isDefinedBy>
</owl:ObjectProperty>

<owl:ObjectProperty rdf:about="http://www.ontologia.fr/OTB/otv#equivalentProperName">
    <rdfs:label>equivalentProperName</rdfs:label> 
    <rdfs:comment>Equivalence relationship between 2 proper names</rdfs:comment>
    <rdfs:domain rdf:resource="http://www.ontologia.fr/OTB/otv#ProperName"/>
    <rdfs:range rdf:resource="http://www.ontologia.fr/OTB/otv#ProperName"/>
    <rdfs:isDefinedBy>http://www.ontologia.fr/OTB/otv.rdf</rdfs:isDefinedBy>
</owl:ObjectProperty>

<owl:ObjectProperty rdf:about="http://www.ontologia.fr/OTB/otv#allonym">
    <rdfs:label>allonym</rdfs:label> 
    <rdfs:comment>Allonymy relationship between 2 proper names</rdfs:comment>
    <rdfs:domain rdf:resource="http://www.ontologia.fr/OTB/otv#ProperName"/>
    <rdfs:range rdf:resource="http://www.ontologia.fr/OTB/otv#ProperName"/>
    <rdfs:isDefinedBy>http://www.ontologia.fr/OTB/otv.rdf</rdfs:isDefinedBy>
</owl:ObjectProperty>

<!-- Relations between the 2 dimensions -->

<owl:ObjectProperty rdf:about="http://www.ontologia.fr/OTB/otv#denotedByTerm">
    <rdfs:label>denotedByTerm</rdfs:label> 
    <rdfs:comment>Link a concept to a term which denotes it</rdfs:comment>
    <rdfs:domain rdf:resource="http://www.ontologia.fr/OTB/otv#Concept"/>
    <rdfs:range rdf:resource="http://www.ontologia.fr/OTB/otv#Term"/>
    <rdfs:isDefinedBy>http://www.ontologia.fr/OTB/otv.rdf</rdfs:isDefinedBy>
</owl:ObjectProperty>

<owl:ObjectProperty rdf:about="http://www.ontologia.fr/OTB/otv#denotedConcept">
    <rdfs:label>denotedConcept</rdfs:label> 
    <rdfs:comment>Property whose value is the OTV concept denoted by the term: &apos;a term is a verbal designation of a concept&apos; (ISO 1087)</rdfs:comment>
    <rdfs:domain rdf:resource="http://www.ontologia.fr/OTB/otv#Term"/>
    <rdfs:range rdf:resource="http://www.ontologia.fr/OTB/otv#Concept"/>
    <rdfs:isDefinedBy>http://www.ontologia.fr/OTB/otv.rdf</rdfs:isDefinedBy>
</owl:ObjectProperty>

<owl:ObjectProperty rdf:about="http://www.ontologia.fr/OTB/otv#denotedByProperName">
    <rdfs:label>denotedByProperName</rdfs:label>
    <rdfs:comment>The denotedByPrperName property links an individual (object) to a proper name which denotes it</rdfs:comment>
 	<rdfs:domain rdf:resource="http://www.ontologia.fr/OTB/otv#Object"/>
 	<rdfs:range rdf:resource="http://www.ontologia.fr/OTB/otv#ProperName"/>
    <rdfs:isDefinedBy>http://www.ontologia.fr/OTB/otv.rdf</rdfs:isDefinedBy>
</owl:ObjectProperty>

<owl:ObjectProperty rdf:about="http://www.ontologia.fr/OTB/otv#denotedObject">
   	<rdfs:label>denotedObject</rdfs:label>
    <rdfs:comment>Property whose value is the OTV object denoted by the proper name</rdfs:comment>
 	<rdfs:domain rdf:resource="http://www.ontologia.fr/OTB/otv#ProperName"/>
 	<rdfs:range rdf:resource="http://www.ontologia.fr/OTB/otv#Object"/>
    <rdfs:isDefinedBy>http://www.ontologia.fr/OTB/otv.rdf</rdfs:isDefinedBy>
</owl:ObjectProperty>


<!-- ***********************************************
                      OTV DATA PROPERTIES
       *********************************************** -->

<owl:DatatypeProperty rdf:about="http://www.ontologia.fr/OTB/otv#conceptName">
    <rdfs:label>conceptName</rdfs:label> 
    <rdfs:comment>Name of the concept</rdfs:comment>
    <rdfs:domain rdf:resource="http://www.ontologia.fr/OTB/otv#Concept"/>
    <rdfs:range rdf:resource="http://www.w3.org/2001/XMLSchema#string"/>
    <rdfs:isDefinedBy>http://www.ontologia.fr/OTB/otv.rdf</rdfs:isDefinedBy>
</owl:DatatypeProperty>

<owl:DatatypeProperty rdf:about="http://www.ontologia.fr/OTB/otv#shortConceptName">
    <rdfs:label>shortConceptName</rdfs:label> 
    <rdfs:comment>the short name of a concept is the preferred term (in the default language) denoting the concept</rdfs:comment>
    <rdfs:domain rdf:resource="http://www.ontologia.fr/OTB/otv#Concept"/>
    <rdfs:range rdf:resource="http://www.w3.org/2001/XMLSchema#string"/>
    <rdfs:isDefinedBy>http://www.ontologia.fr/OTB/otv.rdf</rdfs:isDefinedBy>
</owl:DatatypeProperty>

<owl:DatatypeProperty rdf:about="http://www.ontologia.fr/OTB/otv#termName">
    <rdfs:label>termName</rdfs:label>
    <rdfs:comment>String representing the term</rdfs:comment>
 	  <rdfs:domain rdf:resource="http://www.ontologia.fr/OTB/otv#Term"/>
 	  <rdfs:range rdf:resource="http://www.w3.org/2001/XMLSchema#string"/>
    <rdfs:isDefinedBy>http://www.ontologia.fr/OTB/otv.rdf</rdfs:isDefinedBy>
</owl:DatatypeProperty>

<owl:DatatypeProperty rdf:about="http://www.ontologia.fr/OTB/otv#properName">
    <rdfs:label>properName</rdfs:label>
    <rdfs:comment>String representing the proper name</rdfs:comment>
 	  <rdfs:domain rdf:resource="http://www.ontologia.fr/OTB/otv#ProperName"/>
 	  <rdfs:range rdf:resource="http://www.w3.org/2001/XMLSchema#string"/>
    <rdfs:isDefinedBy>http://www.ontologia.fr/OTB/otv.rdf</rdfs:isDefinedBy>
</owl:DatatypeProperty>

<owl:DatatypeProperty rdf:about="http://www.ontologia.fr/OTB/otv#language">
    <rdfs:label>language</rdfs:label>
    <rdfs:comment>Property that denotes the language of the term</rdfs:comment>
    <rdfs:domain>
      <owl:Class>
        <owl:unionOf rdf:parseType="Collection">
          <rdf:Description rdf:about="http://www.ontologia.fr/OTB/otv#Term"/>
          <rdf:Description rdf:about="http://www.ontologia.fr/OTB/otv#ProperName"/>
        </owl:unionOf>
      </owl:Class>
    </rdfs:domain>
    <rdfs:range rdf:resource="http://www.w3.org/2001/XMLSchema#string"/>
    <rdfs:isDefinedBy>http://www.ontologia.fr/OTB/otv.rdf</rdfs:isDefinedBy>
</owl:DatatypeProperty>

<owl:DatatypeProperty rdf:about="http://www.ontologia.fr/OTB/otv#termStatus">
    <rdfs:label>termStatus</rdfs:label>
    <rdfs:comment>Property that indicates the status of the term</rdfs:comment>
 	  <rdfs:domain rdf:resource="http://www.ontologia.fr/OTB/otv#Term"/>
 	  <rdfs:range rdf:resource="http://www.w3.org/2001/XMLSchema#string"/>
   	<rdfs:isDefinedBy>http://www.ontologia.fr/OTB/otv.rdf</rdfs:isDefinedBy>
</owl:DatatypeProperty>

<owl:DatatypeProperty rdf:about="http://www.ontologia.fr/OTB/otv#termDefinition">
    <rdfs:label>termDefinition</rdfs:label>
    <rdfs:comment>Defintion of the term in natural language</rdfs:comment>
    <rdfs:domain rdf:resource="http://www.ontologia.fr/OTB/otv#Term"/>
    <rdfs:range rdf:resource="http://www.w3.org/2001/XMLSchema#string"/>
    <rdfs:isDefinedBy>http://www.ontologia.fr/OTB/otv.rdf</rdfs:isDefinedBy>
</owl:DatatypeProperty>

<owl:DatatypeProperty rdf:about="http://www.ontologia.fr/OTB/otv#context">
    <rdfs:label>context</rdfs:label>
    <rdfs:comment>Context associated to the term</rdfs:comment>
    <rdfs:domain rdf:resource="http://www.ontologia.fr/OTB/otv#Term"/>
    <rdfs:isDefinedBy>http://www.ontologia.fr/OTB/otv.rdf</rdfs:isDefinedBy>
</owl:DatatypeProperty>

<owl:DatatypeProperty rdf:about="http://www.ontologia.fr/OTB/otv#note">
    <rdfs:label>note</rdfs:label>
    <rdfs:comment>Note associated to the term</rdfs:comment>
    <rdfs:domain rdf:resource="http://www.ontologia.fr/OTB/otv#Term"/>
    <rdfs:isDefinedBy>http://www.ontologia.fr/OTB/otv.rdf</rdfs:isDefinedBy>
</owl:DatatypeProperty>

<owl:DatatypeProperty rdf:about="http://www.ontologia.fr/OTB/otv#partOfSpeech">
    <rdfs:label>partOfSpeech</rdfs:label>
    <rdfs:comment>Part of Speech of the term</rdfs:comment>
    <rdfs:domain rdf:resource="http://www.ontologia.fr/OTB/otv#Term"/>
    <rdfs:range rdf:resource="http://www.w3.org/2001/XMLSchema#string"/>
    <rdfs:isDefinedBy>http://www.ontologia.fr/OTB/otv.rdf</rdfs:isDefinedBy>
</owl:DatatypeProperty>

<owl:DatatypeProperty rdf:about="http://www.ontologia.fr/OTB/otv#gender">
    <rdfs:label>gender</rdfs:label>
    <rdfs:comment>Gender of the term</rdfs:comment>
    <rdfs:domain rdf:resource="http://www.ontologia.fr/OTB/otv#Term"/>
    <rdfs:range rdf:resource="http://www.w3.org/2001/XMLSchema#string"/>
    <rdfs:isDefinedBy>http://www.ontologia.fr/OTB/otv.rdf</rdfs:isDefinedBy>
</owl:DatatypeProperty>

<owl:DatatypeProperty rdf:about="http://www.ontologia.fr/OTB/otv#beginDate">
    <rdfs:label>beginDate</rdfs:label>
    <rdfs:comment>Property that indicates the begin date of of an axis of analysis, concept, term, object</rdfs:comment>
    <rdfs:domain rdf:resource="http://www.ontologia.fr/OTB/otv#OTVCore"/>
    <rdfs:range rdf:resource="http://www.w3.org/2001/XMLSchema#dateTime"/>
    <rdfs:isDefinedBy>http://www.ontologia.fr/OTB/otv.rdf</rdfs:isDefinedBy>
</owl:DatatypeProperty>

<owl:DatatypeProperty rdf:about="http://www.ontologia.fr/OTB/otv#endDate">
     <rdfs:label>endDate</rdfs:label>
     <rdfs:comment>Property that indicates the end date of of an axis of analysis, concept, term, object</rdfs:comment>
     <rdfs:domain rdf:resource="http://www.ontologia.fr/OTB/otv#OTVCore"/>
     <rdfs:range rdf:resource="http://www.w3.org/2001/XMLSchema#dateTime"/>
     <rdfs:isDefinedBy>http://www.ontologia.fr/OTB/otv.rdf</rdfs:isDefinedBy>
</owl:DatatypeProperty>
`;
