import React, { PureComponent } from "react"
import PropTypes from "prop-types"
import { getList } from "core/utils"
import { getExtensions, sanitizeUrl, escapeDeepLinkPath } from "core/utils"
import { safeBuildUrl } from "core/utils/url"
import { Iterable, List } from "immutable"
import ImPropTypes from "react-immutable-proptypes"

import RollingLoadSVG from "core/assets/rolling-load.svg"

import GeneratedTests from "./generated-test"

export default class Operation extends PureComponent {
  static propTypes = {
    specPath: ImPropTypes.list.isRequired,
    operation: PropTypes.instanceOf(Iterable).isRequired,
    summary: PropTypes.string,
    response: PropTypes.instanceOf(Iterable),
    request: PropTypes.instanceOf(Iterable),

    toggleShown: PropTypes.func.isRequired,
    onTryoutClick: PropTypes.func.isRequired,
    onResetClick: PropTypes.func.isRequired,
    onCancelClick: PropTypes.func.isRequired,
    onExecute: PropTypes.func.isRequired,

    getComponent: PropTypes.func.isRequired,
    getConfigs: PropTypes.func.isRequired,
    authActions: PropTypes.object,
    authSelectors: PropTypes.object,
    specActions: PropTypes.object.isRequired,
    specSelectors: PropTypes.object.isRequired,
    oas3Actions: PropTypes.object.isRequired,
    oas3Selectors: PropTypes.object.isRequired,
    layoutActions: PropTypes.object.isRequired,
    layoutSelectors: PropTypes.object.isRequired,
    fn: PropTypes.object.isRequired
  }

  static defaultProps = {
    operation: null,
    response: null,
    request: null,
    specPath: List(),
    summary: ""
  }

    state = {
        generatedTests: [],
        isTestStreamActive: false,
        isGeneratingTest: false,
    }

    handleGenerateTest = async (path, method) => {
        const { specSelectors } = this.props;

        const requestDetails = specSelectors.requestFor(path, method);
        let operationProps = this.props.operation;
        let { summary } = operationProps.toJS();

        if (!requestDetails) {
            alert("Please execute the API first to generate tests.");
            return;
        }
        
        let payload = {};
        if (requestDetails instanceof Object) {
            payload = Object.fromEntries(requestDetails);
        } else {
            payload = { ...requestDetails };
        }

        if (payload.body) {
            try {
                payload.json_body = JSON.parse(payload.body);
            } catch (error) {
                console.warn("Body is not valid JSON. Leaving as-is.");
            }
        }

        // fixes map to object (like headers)
        payload = JSON.parse(JSON.stringify(payload));

        this.setState({
            isGeneratingTest: true,
            isTestStreamActive: true,
            generatedTests: [] 
        });
        
        try {
            const response = await fetch(`https://staging-be.kusho.ai/vscode/generate/streaming`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-KUSHO-SOURCE": "swagger",
                },
                body: JSON.stringify({
                    machine_id: "swagger_ui", // Replace with the actual machine ID or login details
                    api_info: payload,
                    test_suite_name: summary, // section - api summary
                }),
            });

            const reader = response.body.getReader();
            const decoder = new TextDecoder();

            while (true) {
                const { done, value } = await reader.read();

                if (done)
                    break;

                let chunk = decoder.decode(value);
                
                if (chunk === "[DONE]")
                    break;

                chunk = chunk.replace("event:test_case\ndata:", "").replace("\n\n", "");
                try{
                    this.setState((prevState) => ({
                        generatedTests: [...prevState.generatedTests, JSON.parse(JSON.stringify(chunk))],
                    }));
                }catch (error) {
                    console.warn("Chunk not valid json - ", chunk);
                }
            }

            this.setState({ 
                isTestStreamActive: false,
                isGeneratingTest: false 
            });
        } catch (error) {
            console.error('Test generation error:', error);
            this.setState({ 
                isTestStreamActive: false,
                isGeneratingTest: false,
                generatedTests: [`Error generating tests: ${error.message}`]
            });
        }
    }

  render() {
    let {
      specPath,
      response,
      request,
      toggleShown,
      onTryoutClick,
      onResetClick,
      onCancelClick,
      onExecute,
      fn,
      getComponent,
      getConfigs,
      specActions,
      specSelectors,
      authActions,
      authSelectors,
      oas3Actions,
      oas3Selectors
    } = this.props
    let operationProps = this.props.operation

    let {
      deprecated,
      isShown,
      path,
      method,
      op,
      tag,
      operationId,
      allowTryItOut,
      displayRequestDuration,
      tryItOutEnabled,
      executeInProgress
    } = operationProps.toJS()

    let {
      description,
      externalDocs,
      schemes
    } = op

    const externalDocsUrl = externalDocs ? safeBuildUrl(externalDocs.url, specSelectors.url(), { selectedServer: oas3Selectors.selectedServer() }) : ""
    let operation = operationProps.getIn(["op"])
    let responses = operation.get("responses")
    let parameters = getList(operation, ["parameters"])
    let operationScheme = specSelectors.operationScheme(path, method)
    let isShownKey = ["operations", tag, operationId]
    let extensions = getExtensions(operation)

    const Responses = getComponent("responses")
    const Parameters = getComponent( "parameters" )
    const Execute = getComponent( "execute" )
    const Clear = getComponent( "clear" )
    const Collapse = getComponent( "Collapse" )
    const Markdown = getComponent("Markdown", true)
    const Schemes = getComponent( "schemes" )
    const OperationServers = getComponent( "OperationServers" )
    const OperationExt = getComponent( "OperationExt" )
    const OperationSummary = getComponent( "OperationSummary" )
    const Link = getComponent( "Link" )

    const { showExtensions } = getConfigs()

    // Merge in Live Response
    if(responses && response && response.size > 0) {
      let notDocumented = !responses.get(String(response.get("status"))) && !responses.get("default")
      response = response.set("notDocumented", notDocumented)
    }

    let onChangeKey = [ path, method ] // Used to add values to _this_ operation ( indexed by path and method )

    const validationErrors = specSelectors.validationErrors([path, method])

    const { generatedTests, isTestStreamActive, isGeneratingTest } = this.state;

    return (
        <div className={deprecated ? "opblock opblock-deprecated" : isShown ? `opblock opblock-${method} is-open` : `opblock opblock-${method}`} id={escapeDeepLinkPath(isShownKey.join("-"))} >
            <OperationSummary 
                operationProps={operationProps} 
                isShown={isShown} 
                toggleShown={toggleShown} 
                getComponent={getComponent} 
                authActions={authActions} 
                authSelectors={authSelectors} 
                specPath={specPath} 
                onGenerateTest={this.handleGenerateTest}
                isGeneratingTest={isGeneratingTest}
            />
          <Collapse isOpened={isShown}>
            <div className="opblock-body">
              { (operation && operation.size) || operation === null ? null :
                <RollingLoadSVG height="32px" width="32px" className="opblock-loading-animation" />
              }
              { deprecated && <h4 className="opblock-title_normal"> Warning: Deprecated</h4>}
              { description &&
                <div className="opblock-description-wrapper">
                  <div className="opblock-description">
                    <Markdown source={ description } />
                  </div>
                </div>
              }
              {
                externalDocsUrl ?
                <div className="opblock-external-docs-wrapper">
                  <h4 className="opblock-title_normal">Find more details</h4>
                  <div className="opblock-external-docs">
                    {externalDocs.description &&
                      <span className="opblock-external-docs__description">
                        <Markdown source={ externalDocs.description } />
                      </span>
                    }
                    <Link target="_blank" className="opblock-external-docs__link" href={sanitizeUrl(externalDocsUrl)}>{externalDocsUrl}</Link>
                  </div>
                </div> : null
              }

              { !operation || !operation.size ? null :
                <Parameters
                  parameters={parameters}
                  specPath={specPath.push("parameters")}
                  operation={operation}
                  onChangeKey={onChangeKey}
                  onTryoutClick = { onTryoutClick }
                  onResetClick = { onResetClick }
                  onCancelClick = { onCancelClick }
                  tryItOutEnabled = { tryItOutEnabled }
                  allowTryItOut={allowTryItOut}

                  fn={fn}
                  getComponent={ getComponent }
                  specActions={ specActions }
                  specSelectors={ specSelectors }
                  pathMethod={ [path, method] }
                  getConfigs={ getConfigs }
                  oas3Actions={ oas3Actions }
                  oas3Selectors={ oas3Selectors }
                />
              }

              { !tryItOutEnabled ? null :
                <OperationServers
                  getComponent={getComponent}
                  path={path}
                  method={method}
                  operationServers={operation.get("servers")}
                  pathServers={specSelectors.paths().getIn([path, "servers"])}
                  getSelectedServer={oas3Selectors.selectedServer}
                  setSelectedServer={oas3Actions.setSelectedServer}
                  setServerVariableValue={oas3Actions.setServerVariableValue}
                  getServerVariable={oas3Selectors.serverVariableValue}
                  getEffectiveServerValue={oas3Selectors.serverEffectiveValue}
                />
              }

              {!tryItOutEnabled || !allowTryItOut ? null : schemes && schemes.size ? <div className="opblock-schemes">
                    <Schemes schemes={ schemes }
                             path={ path }
                             method={ method }
                             specActions={ specActions }
                             currentScheme={ operationScheme } />
                  </div> : null
              }

              { !tryItOutEnabled || !allowTryItOut || validationErrors.length <= 0 ? null : <div className="validation-errors errors-wrapper">
                  Please correct the following validation errors and try again.
                  <ul>
                    { validationErrors.map((error, index) => <li key={index}> { error } </li>) }
                  </ul>
                </div>
              }

            <div className={(!tryItOutEnabled || !response || !allowTryItOut) ? "execute-wrapper" : "btn-group"}>
              { !tryItOutEnabled || !allowTryItOut ? null :

                  <Execute
                    operation={ operation }
                    specActions={ specActions }
                    specSelectors={ specSelectors }
                    oas3Selectors={ oas3Selectors }
                    oas3Actions={ oas3Actions }
                    path={ path }
                    method={ method }
                    onExecute={ onExecute }
                    disabled={executeInProgress}/>
              }

              { (!tryItOutEnabled || !response || !allowTryItOut) ? null :
                  <Clear
                    specActions={ specActions }
                    path={ path }
                    method={ method }/>
              }
            </div>

            {executeInProgress ? <div className="loading-container"><div className="loading"></div></div> : null}

              { !responses ? null :
                  <Responses
                    responses={ responses }
                    request={ request }
                    tryItOutResponse={ response }
                    getComponent={ getComponent }
                    getConfigs={ getConfigs }
                    specSelectors={ specSelectors }
                    oas3Actions={oas3Actions}
                    oas3Selectors={oas3Selectors}
                    specActions={ specActions }
                    produces={specSelectors.producesOptionsFor([path, method]) }
                    producesValue={ specSelectors.currentProducesFor([path, method]) }
                    specPath={specPath.push("responses")}
                    path={ path }
                    method={ method }
                    displayRequestDuration={ displayRequestDuration }
                    fn={fn} />
              }

              { !showExtensions || !extensions.size ? null :
                <OperationExt extensions={ extensions } getComponent={ getComponent } />
              }

                <GeneratedTests
                    getComponent={ getComponent }
                    generatedTests={generatedTests}
                    isTestStreamActive={isTestStreamActive}
                />

            </div>
          </Collapse>
        </div>
    )
  }

}
