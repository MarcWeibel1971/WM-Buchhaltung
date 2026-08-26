import java.io.File;
import javax.xml.XMLConstants;
import javax.xml.transform.stream.StreamSource;
import javax.xml.validation.Schema;
import javax.xml.validation.SchemaFactory;
import javax.xml.validation.Validator;

public class ValidateXml {
  public static void main(String[] args) throws Exception {
    if (args.length != 2) throw new IllegalArgumentException("Usage: ValidateXml <schema.xsd> <document.xml>");
    SchemaFactory factory = SchemaFactory.newInstance(XMLConstants.W3C_XML_SCHEMA_NS_URI);
    Schema schema = factory.newSchema(new File(args[0]));
    Validator validator = schema.newValidator();
    validator.validate(new StreamSource(new File(args[1])));
    System.out.println("XML validiert gegen " + args[0]);
  }
}
